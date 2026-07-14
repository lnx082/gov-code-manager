/**
 * 系统通知管理
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { filterMyPending } from './approvals.js';

const router = Router();

// 获取通知列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, isRead } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('notifications').where('user_id', req.user.userId);
    
    if (isRead !== undefined) {
      query = query.where('is_read', isRead === 'true');
    }
    
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

// 标记已读
router.post('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await db('notifications')
      .where('notification_id', id)
      .where('user_id', req.user.userId)
      .update({ is_read: true });
    
    res.json({ code: 200, message: '已标记为已读' });
  } catch (error) {
    next(error);
  }
});

// 全部标记已读
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await db('notifications')
      .where('user_id', req.user.userId)
      .where('is_read', false)
      .update({ is_read: true });

    res.json({ code: 200, message: '全部已标记为已读' });
  } catch (error) {
    next(error);
  }
});

// 获取未读通知总数（系统通知 + 待我审批，使用共享过滤逻辑）
router.get('/count', authenticate, async (req, res, next) => {
  try {
    // 1. 未读系统通知数
    let sysUnread = 0;
    try {
      const r = await db('notifications').where('user_id', req.user.userId).where('is_read', false).count('* as c').first();
      sysUnread = parseInt(r?.c || 0);
    } catch { /* ignore */ }

    // 2. 待我审批数 — 复用 approvals.js 的共享过滤函数（批量加载，无N+1，无admin兜底）
    let pendingCount = 0;
    try {
      const allPending = await db('approvals').where('status', 'pending').select('*');
      const myPending = await filterMyPending(allPending, req.user);
      pendingCount = myPending.length;
    } catch { /* ignore */ }

    res.json({ code: 200, data: { count: sysUnread + pendingCount } });
  } catch (error) {
    next(error);
  }
});

// 发布通知（管理员）
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ code: 400, message: '标题和内容不能为空' });
    }

    // 获取所有用户
    const users = await db('user_profiles').select('user_id');
    if (users.length === 0) {
      return res.status(400).json({ code: 400, message: '没有可推送的用户' });
    }

    // 为每个用户创建通知
    const notifications = users.map(u => ({
      user_id: u.user_id,
      type: 'system',
      title,
      content,
      is_read: false,
      created_at: new Date(),
    }));

    // 分批插入避免单条 SQL 过大
    const BATCH_SIZE = 50;
    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      await db('notifications').insert(notifications.slice(i, i + BATCH_SIZE));
    }

    res.json({ code: 200, message: `通知已发布，推送给 ${notifications.length} 位用户` });
  } catch (error) {
    next(error);
  }
});

export default router;
