/**
 * 系统通知管理
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 步骤名 → 角色码映射（与 approvals.js 保持一致）
function getRoleForStep(stepName) {
  if (!stepName) return null;
  const s = stepName.trim();
  if (s.includes('系统管理员')) return 'admin';
  if (s.includes('项目管理员')) return 'project_manager';
  if (s.includes('开发人员')) return 'developer';
  if (s.includes('审计')) return 'auditor';
  return null;
}

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

// 获取未读通知总数（系统通知 + 待我审批，带部门密级过滤）
router.get('/count', authenticate, async (req, res, next) => {
  try {
    const userRole = req.user.roleCode || 'user';
    const isAdmin = userRole === 'admin';

    // 1. 未读系统通知数
    let sysUnread = 0;
    try {
      const r = await db('notifications').where('user_id', req.user.userId).where('is_read', false).count('* as c').first();
      sysUnread = parseInt(r?.c || 0);
    } catch { /* ignore */ }

    // 2. 待我审批数（与 /approvals/pending 保持一致的过滤逻辑）
    //    部门密级过滤
    const profile = await db('user_profiles')
      .select('department_id', 'secret_level')
      .where('user_id', req.user.userId)
      .first();
    const deptId = profile?.department_id || null;
    const userSecretLevel = (profile?.secret_level || 'secret').toLowerCase();

    // 密级层级
    const SECRET_HIERARCHY = { 'public': 1, 'internal': 2, 'secret': 3, 'confidential': 4, 'top-secret': 5 };
    const userLevel = SECRET_HIERARCHY[userSecretLevel] || 1;

    let pendingCount = 0;
    try {
      const allPending = await db('approvals').where('status', 'pending');
      for (const approval of allPending) {
        // 部门隔离（与 /approvals/pending 一致）
        if (!isAdmin && deptId) {
          const applicant = await db('user_profiles').where('user_id', approval.applicant_user_id).first();
          if (!applicant || applicant.department_id !== deptId) continue;
        }
        // 密级管控（与 /approvals/pending 一致）
        if (!isAdmin) {
          const rl = SECRET_HIERARCHY[(approval.secret_level || 'secret').toLowerCase()] || 0;
          if (rl > userLevel) continue;
        }

        // 步骤角色匹配
        let steps = [];
        if (approval.approval_flow_id) {
          const flow = await db('approval_flows').where('flow_id', approval.approval_flow_id).first();
          if (flow) {
            try { steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps || []); } catch {}
          }
        }
        const stepIdx = (approval.current_step || 1) - 1;
        const requiredRole = getRoleForStep(steps[stepIdx] || '');

        // auditor 和 security_auditor 视为等价角色
        const auditRoles = ['auditor', 'security_auditor'];
        const roleMatch = requiredRole && (
          requiredRole === userRole ||
          (auditRoles.includes(requiredRole) && auditRoles.includes(userRole))
        );

        if (roleMatch) pendingCount++;
        else if (!approval.approval_flow_id && isAdmin) pendingCount++;
      }
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
