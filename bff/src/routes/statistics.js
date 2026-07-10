import { Router } from 'express';
import db from '../database/connection.js';
import config from '../config/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取仪表盘统计
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    // 按用户角色过滤待审批数
    const userRole = req.user.roleCode || 'user';
    const isAdmin = userRole === 'admin';
    function getRoleForStep(name) {
      if (!name) return null;
      if (name.includes('系统管理员')) return 'admin';
      if (name.includes('项目管理员')) return 'project_manager';
      return null;
    }
    const allPending = await db('approvals').where('status', 'pending');
    let pendingApprovals = 0;
    for (const a of allPending) {
      let steps = [];
      if (a.approval_flow_id) {
        const flow = await db('approval_flows').where('flow_id', a.approval_flow_id).first();
        if (flow) { try { steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps||[]); } catch {} }
      }
      const stepIdx = (a.current_step||1)-1;
      const requiredRole = getRoleForStep(steps[stepIdx]||'');
      if (requiredRole && requiredRole === userRole) pendingApprovals++;
      else if (!a.approval_flow_id && isAdmin) pendingApprovals++;
    }

    const versionCount = await db('approvals').where('operation_type', 'version_release').count('* as count').first();
    const baselineCount = await db('baselines').where('status', 'active').count('* as count').first();
    const userCount = await db('user_profiles').where('is_active', true).count('* as count').first();
    const onlineCount = await db('sessions')
      .where('expires_at', '>', new Date())
      .count('* as count').first();

    // 从 Gitea 获取仓库数和真实版本（tag）数
    let repoCount = 0;
    let giteaVersionCount = 0;
    const adminToken = config.gitea?.token || '';
    if (adminToken) {
      try {
        const reposRes = await fetch(`${config.gitea.url}/api/v1/user/repos?limit=200`, {
          headers: { 'Authorization': adminToken }
        });
        const repos = await reposRes.json();
        if (Array.isArray(repos)) {
          repoCount = repos.length;
          for (const repo of repos) {
            try {
              const tagsRes = await fetch(`${config.gitea.url}/api/v1/repos/${repo.owner.login}/${repo.name}/tags?limit=100`, {
                headers: { 'Authorization': adminToken }
              });
              const tags = await tagsRes.json();
              if (Array.isArray(tags)) giteaVersionCount += tags.length;
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }

    res.json({
      code: 200,
      data: {
        repoCount,
        pendingApprovals,
        versionCount: giteaVersionCount || parseInt(versionCount.count),
        baselineCount: parseInt(baselineCount.count),
        userCount: parseInt(userCount.count),
        onlineUsers: parseInt(onlineCount.count),
        storageUsed: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取趋势数据
router.get('/trends', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 生成模拟趋势数据
    const data = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.unshift({
        date: date.toISOString().split('T')[0],
        commits: Math.floor(Math.random() * 50) + 10,
        versions: Math.floor(Math.random() * 5) + 1,
        approvals: Math.floor(Math.random() * 10) + 2,
      });
    }
    
    res.json({ code: 200, data });
  } catch (error) {
    next(error);
  }
});

export default router;
