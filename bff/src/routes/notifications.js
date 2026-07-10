/**
 * 系统通知管理
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

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

export default router;
