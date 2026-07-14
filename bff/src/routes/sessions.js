/**
 * 在线会话管理（管理员查看全部会话）
 *
 * 【功能】会话列表查询（管理员可查看全部在线用户）、删除会话、刷新会话
 * 【数据】查询/写入：sessions（会话记录）
 * 【来源】openGauss（通过 db()）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 获取所有在线用户（管理员）
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    // 查询活跃会话，关联用户信息
    const onlineUsers = await db('sessions')
      .select(
        'sessions.*',
        'user_profiles.nickname',
        'user_profiles.gitea_username',
        'user_profiles.role_code',
        'user_profiles.department_id',
        'departments.name as department_name'
      )
      .leftJoin('user_profiles', 'sessions.user_id', 'user_profiles.user_id')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .where('sessions.expires_at', '>', new Date())
      .orderBy('sessions.last_active_at', 'desc');

    return res.json({
      code: 200,
      data: {
        total: onlineUsers.length,
        list: onlineUsers.map(s => ({
          session_id: s.session_id,
          user_id: s.user_id,
          username: s.gitea_username || s.username,
          nickname: s.nickname || '',
          role_code: s.role_code || '',
          department_name: s.department_name || '',
          ip_address: s.ip_address,
          login_time: s.created_at,
          last_active: s.last_active_at,
          user_agent: s.user_agent,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

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
