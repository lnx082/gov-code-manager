/**
 * 审计报表管理（生成/下载/删除）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取报表列表
router.get('/', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const total = await db('reports').count('* as count').first();
    const list = await db('reports')
      .orderBy('created_at', 'desc')
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

// 生成报表
router.post('/generate', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { templateId, name, format, parameters } = req.body;
    
    const _insertResult = await db('reports').insert({
      template_id: templateId,
      name,
      format: format || 'pdf',
      parameters: JSON.stringify(parameters || {}),
      status: 'generating',
      created_by: req.user.userId,
      created_at: new Date(),
    });
    const reportId = _insertResult && Array.isArray(_insertResult) ? _insertResult[0] : null;
    
    // 模拟报表生成
    setTimeout(async () => {
      await db('reports')
        .where('report_id', reportId)
        .update({
          status: 'completed',
          file_path: `/reports/${reportId}.${format || 'pdf'}`,
        });
    }, 2000);
    
    res.json({ code: 200, message: '报表生成中', data: { reportId } });
  } catch (error) {
    next(error);
  }
});

export default router;
