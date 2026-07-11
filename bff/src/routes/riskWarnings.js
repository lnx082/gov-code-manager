/**
 * 风险预警管理（列表/处理/统计）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取风险预警列表
router.get('/', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, level, type, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('risk_warnings');
    
    if (level) query = query.where('level', level);
    if (type) query = query.where('type', type);
    if (status) query = query.where('status', status);
    
    const total = await query.clone().count('* as count').first();
    const list = await query.orderBy('created_at', 'desc')
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

// 处理风险预警
router.post('/:id/handle', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body;

    // 获取预警信息
    const warning = await db('risk_warnings').where('warning_id', id).first();
    if (!warning) {
      return res.status(404).json({ code: 404, message: '预警不存在' });
    }

    await db('risk_warnings')
      .where('warning_id', id)
      .update({
        status: 'handled',
        handler_user_id: req.user.userId,
        handler_comment: comment,
        handled_at: new Date(),
      });

    // 如果选择了"通知用户"，给相关用户发送系统通知
    if (action === 'notify' && warning.related_user_id) {
      try {
        await db('notifications').insert({
          user_id: warning.related_user_id,
          type: 'risk_warning',
          title: '风险预警处理通知',
          content: `您触发的风险预警"${warning.title || ''}"已被处理。处理说明：${comment || '无'}`,
          is_read: false,
          created_at: new Date(),
        });
      } catch (notifyErr) {
        console.warn('发送预警通知失败:', notifyErr.message);
      }
    }

    res.json({ code: 200, message: '处理成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
