/**
 * 审计日志查询 + 完整性验证
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取审计日志列表
router.get('/logs', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, username, actionType, target, startDate, endDate } = req.query;
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
    if (target) {
      query = query.where(function() {
        this.where('target_name', 'like', `%${target}%`)
            .orWhere('request_path', 'like', `%${target}%`);
      });
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

// 获取操作统计（报表页顶部统计卡片）
router.get('/stats/operations', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = db('audit_logs');
    if (startDate) query = query.where('timestamp', '>=', startDate);
    if (endDate) query = query.where('timestamp', '<=', endDate);

    // 总操作数
    const totalOp = await query.clone().count('* as count').first();
    // 活跃用户数
    const activeUsers = await query.clone().select('username').count('* as count').whereNotNull('username').groupBy('username');
    // 仓库操作数（含 repos 路径的请求）
    const repoOps = await query.clone().where('request_path', 'like', '%/repos/%').count('* as count').first();
    // 风险预警数
    let riskCount = 0;
    try {
      const risk = await db('risk_warnings').count('* as count').first();
      riskCount = parseInt(risk?.count || 0);
    } catch { /* 忽略 */ }

    res.json({
      code: 200,
      data: {
        totalOperations: parseInt(totalOp?.count || 0),
        totalUsers: activeUsers?.length || 0,
        totalRepos: parseInt(repoOps?.count || 0),
        riskCount,
        // 兼容旧字段名
        total: parseInt(totalOp?.count || 0),
        users: activeUsers?.length || 0,
        repos: parseInt(repoOps?.count || 0),
        risks: riskCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 导出审计日志（CSV格式）
router.get('/export', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { username, actionType, target, startDate, endDate } = req.query;

    let query = db('audit_logs').orderBy('timestamp', 'desc');

    if (username) query = query.where('username', 'like', `%${username}%`);
    if (actionType) query = query.where('action_type', actionType);
    if (startDate) query = query.where('timestamp', '>=', startDate);
    if (endDate) query = query.where('timestamp', '<=', endDate);
    if (target) {
      query = query.where(function() {
        this.where('target_name', 'like', `%${target}%`)
            .orWhere('request_path', 'like', `%${target}%`);
      });
    }

    const logs = await query.limit(10000);

    // 生成 CSV
    const headers = ['时间', '用户名', '操作类型', '操作描述', 'IP地址', '结果', '请求路径', 'User-Agent'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const time = log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19) : '';
      const row = [
        time,
        `"${(log.username || '').replace(/"/g, '""')}"`,
        `"${(log.action_type || '').replace(/"/g, '""')}"`,
        `"${(log.action_name || '').replace(/"/g, '""')}"`,
        log.request_ip || '',
        log.result || '',
        `"${(log.request_path || '').replace(/"/g, '""')}"`,
        `"${(log.request_user_agent || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csv = '﻿' + csvRows.join('\n'); // BOM for Excel UTF-8

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit_logs_${new Date().toISOString().slice(0, 10)}.csv"`,
      'Content-Length': Buffer.byteLength(csv, 'utf-8'),
    });
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
