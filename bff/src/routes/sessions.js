import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取我的会话列表
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const sessions = await db('sessions')
      .where('user_id', req.user.userId)
      .where('expires_at', '>', new Date())
      .orderBy('last_active_at', 'desc');
    
    res.json({ code: 200, data: sessions });
  } catch (error) {
    next(error);
  }
});

// 删除会话
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    await db('sessions')
      .where('session_id', sessionId)
      .where('user_id', req.user.userId)
      .delete();
    
    res.json({ code: 200, message: '会话已删除' });
  } catch (error) {
    next(error);
  }
});

// 清除其他会话
router.delete('/others/clear', authenticate, async (req, res, next) => {
  try {
    const currentSession = req.headers['x-session-id'];
    
    await db('sessions')
      .where('user_id', req.user.userId)
      .whereNot('session_id', currentSession)
      .delete();
    
    res.json({ code: 200, message: '其他会话已清除' });
  } catch (error) {
    next(error);
  }
});

export default router;
