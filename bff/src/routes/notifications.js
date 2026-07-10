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

// 获取待审批通知计数（实时：当前步骤需要当前用户审批的数量）
router.get('/count', authenticate, async (req, res, next) => {
  try {
    const userRole = req.user.roleCode || 'user';
    const isAdmin = userRole === 'admin';

    // 步骤名 → 角色码映射
    function getRoleForStep(name) {
      if (!name) return null;
      if (name.includes('系统管理员')) return 'admin';
      if (name.includes('项目管理员')) return 'project_manager';
      return null;
    }

    const allPending = await db('approvals').where('status', 'pending');
    let count = 0;
    for (const approval of allPending) {
      let steps = [];
      if (approval.approval_flow_id) {
        const flow = await db('approval_flows').where('flow_id', approval.approval_flow_id).first();
        if (flow) {
          try { steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps || []); } catch {}
        }
      }
      const stepIdx = (approval.current_step || 1) - 1;
      const requiredRole = getRoleForStep(steps[stepIdx] || '');
      if (requiredRole && requiredRole === userRole) count++;
      else if (!approval.approval_flow_id && isAdmin) count++;
    }

    res.json({ code: 200, data: { count } });
  } catch (error) {
    next(error);
  }
});

export default router;
