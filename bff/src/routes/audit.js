import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取审计日志列表
router.get('/logs', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, username, actionType, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('audit_logs');
    
    if (username) {
      query = query.where('username', 'like', `%${username}%`);
    }
    if (actionType) {
      query = query.where('action_type', actionType);
    }
    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }
    
    const total = await query.clone().count('* as count').first();
    const list = await query.orderBy('timestamp', 'desc')
      .limit(parseInt(pageSize))
      .offset(offset);
    
    res.json({
      code: 200,
      data: {
        list,
        total: parseInt(total.count),
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取审计日志详情
router.get('/logs/:id', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await db('audit_logs').where('log_id', id).first();
    
    if (!log) {
      return res.status(404).json({ code: 404, message: '日志不存在' });
    }
    
    res.json({
      code: 200,
      data: log,
    });
  } catch (error) {
    next(error);
  }
});

// 验证日志完整性
router.post('/logs/verify-integrity', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { startLogId, endLogId } = req.body;
    
    const logs = await db('audit_logs')
      .whereBetween('log_id', [startLogId, endLogId])
      .orderBy('timestamp', 'asc');
    
    // 验证哈希链
    let prevHash = null;
    let isValid = true;
    const invalidLogs = [];
    
    for (const log of logs) {
      if (prevHash && log.prev_hash !== prevHash) {
        isValid = false;
        invalidLogs.push(log.log_id);
      }
      prevHash = log.integrity_hash;
    }
    
    res.json({
      code: 200,
      data: {
        isValid,
        totalLogs: logs.length,
        invalidLogs,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取操作统计
router.get('/stats/operations', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = db('audit_logs');
    
    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }
    
    const stats = await query
      .select('action_type')
      .count('* as count')
      .groupBy('action_type');
    
    res.json({
      code: 200,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
