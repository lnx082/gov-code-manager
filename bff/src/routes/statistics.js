/**
 * 仪表盘统计数据 + 趋势数据
 */
import { Router } from 'express';
import os from 'os';
import { execSync } from 'child_process';
import db from '../database/connection.js';
import config from '../config/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取仪表盘统计
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    // 按用户角色过滤待审批数（与 /approvals/pending、/notifications/count 保持一致）
    const userRole = req.user.roleCode || 'user';
    const isAdmin = userRole === 'admin';

    // 获取部门密级过滤条件
    const profile = await db('user_profiles')
      .select('department_id', 'secret_level')
      .where('user_id', req.user.userId)
      .first();
    const deptId = profile?.department_id || null;
    const userSecretLevel = (profile?.secret_level || 'secret').toLowerCase();
    const SECRET_HIERARCHY = { 'public': 1, 'internal': 2, 'secret': 3, 'confidential': 4, 'top-secret': 5 };
    const userLevel = SECRET_HIERARCHY[userSecretLevel] || 1;

    function getRoleForStep(name) {
      if (!name) return null;
      const s = name.trim();
      if (s.includes('系统管理员')) return 'admin';
      if (s.includes('项目管理员')) return 'project_manager';
      if (s.includes('开发人员')) return 'developer';
      if (s.includes('审计')) return 'auditor';
      return null;
    }
    const auditRoles = ['auditor', 'security_auditor'];

    const allPending = await db('approvals').where('status', 'pending');
    let pendingApprovals = 0;
    for (const a of allPending) {
      // 部门隔离（与 /approvals/pending 一致）
      if (!isAdmin && deptId) {
        const applicant = await db('user_profiles').where('user_id', a.applicant_user_id).first();
        if (!applicant || applicant.department_id !== deptId) continue;
      }
      // 密级管控（与 /approvals/pending 一致）
      if (!isAdmin) {
        const rl = SECRET_HIERARCHY[(a.secret_level || 'secret').toLowerCase()] || 0;
        if (rl > userLevel) continue;
      }

      let steps = [];
      if (a.approval_flow_id) {
        const flow = await db('approval_flows').where('flow_id', a.approval_flow_id).first();
        if (flow) { try { steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps||[]); } catch {} }
      }
      const stepIdx = (a.current_step||1)-1;
      const requiredRole = getRoleForStep(steps[stepIdx]||'');

      // auditor 和 security_auditor 视为等价角色
      const roleMatch = requiredRole && (
        requiredRole === userRole ||
        (auditRoles.includes(requiredRole) && auditRoles.includes(userRole))
      );
      if (roleMatch) pendingApprovals++;
      else if (!a.approval_flow_id && isAdmin) pendingApprovals++;
    }

    const versionCount = await db('approvals').where('operation_type', 'version_release').count('* as count').first();
    const baselineCount = await db('baselines').where('status', 'active').count('* as count').first();
    const userCount = await db('user_profiles').where('is_active', true).count('* as count').first();
    const onlineCount = await db('sessions')
      .where('expires_at', '>', new Date())
      .count('* as count').first();

    // 从 Gitea 获取仓库数和真实版本（tag）数
    // 管理员：尝试 admin API 获取全部仓库；普通用户：用自己 token 查 /user/repos
    let repoCount = 0;
    let giteaVersionCount = 0;
    const adminToken = config.gitea?.token || '';
    const userToken = req.user?.giteaToken || '';

    // 选择最佳 token 和 API 路径
    let repos = [];
    let repoAuthHeader = '';

    if (isAdmin && adminToken) {
      // 管理员：尝试 admin/repos → repos/search → user/repos
      const adminAuth = adminToken.startsWith('Basic ') || adminToken.startsWith('Bearer ')
        ? adminToken : `Bearer ${adminToken}`;

      try {
        const adminRes = await fetch(`${config.gitea.url}/api/v1/admin/repos?limit=200`, {
          headers: { 'Authorization': adminAuth }
        });
        if (adminRes.ok) {
          repos = await adminRes.json();
          repoAuthHeader = adminAuth;
        } else if (adminRes.status === 404) {
          const searchRes = await fetch(`${config.gitea.url}/api/v1/repos/search?limit=200`, {
            headers: { 'Authorization': adminAuth }
          });
          if (searchRes.ok) {
            const result = await searchRes.json();
            repos = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
            repoAuthHeader = adminAuth;
          }
        }
      } catch { /* skip */ }
    }

    // 降级：使用用户自己的 token
    if (repos.length === 0 && userToken) {
      const userAuth = userToken.startsWith('Basic ') ? userToken : `token ${userToken}`;
      try {
        const userRes = await fetch(`${config.gitea.url}/api/v1/user/repos?limit=200`, {
          headers: { 'Authorization': userAuth }
        });
        if (userRes.ok) {
          repos = await userRes.json();
          repoAuthHeader = userAuth;
        }
      } catch { /* skip */ }
    }

    if (Array.isArray(repos) && repos.length > 0) {
      repoCount = repos.length;
      repoAuthHeader = repoAuthHeader || (adminToken.startsWith('Basic ') || adminToken.startsWith('Bearer ')
        ? adminToken : `Bearer ${adminToken}`);
      for (const repo of repos) {
        try {
          const tagsRes = await fetch(`${config.gitea.url}/api/v1/repos/${repo.owner.login}/${repo.name}/tags?limit=100`, {
            headers: { 'Authorization': repoAuthHeader }
          });
          const tags = await tagsRes.json();
          if (Array.isArray(tags)) giteaVersionCount += tags.length;
        } catch { /* skip */ }
      }
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

// 服务器系统状态（实时）
router.get('/system', authenticate, async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // 磁盘（Windows: wmic, Linux: df）
    let diskTotal = 0, diskFree = 0;
    try {
      if (process.platform === 'win32') {
        const out = execSync('wmic logicaldisk get size,freespace /format:csv', { timeout: 3000 }).toString();
        const lines = out.trim().split('\n').slice(2);
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 3) { diskFree += parseInt(parts[1]) || 0; diskTotal += parseInt(parts[2]) || 0; }
        }
      } else {
        const out = execSync("df -B1 / | tail -1 | awk '{print $2,$4}'", { timeout: 3000 }).toString().trim();
        const [total, free] = out.split(' ').map(Number);
        diskTotal = total || 0;
        diskFree = free || 0;
      }
    } catch { /* disk info unavailable */ }

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model?.replace(/\s+/g, ' ').trim() || 'Unknown';
    const cpuCores = cpus.length;

    // 粗略 CPU 使用率（1 秒采样）
    let cpuUsage = 0;
    try {
      const start = os.cpus().map(c => c.times);
      await new Promise(r => setTimeout(r, 1000));
      const end = os.cpus().map(c => c.times);
      let totalDiff = 0, idleDiff = 0;
      for (let i = 0; i < start.length; i++) {
        const s = start[i], e = end[i];
        const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
        const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;
        totalDiff += eTotal - sTotal;
        idleDiff += e.idle - s.idle;
      }
      cpuUsage = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
    } catch { /* cpu usage unavailable */ }

    // 远程服务连通性检查
    let giteaOk = false, dbOk = false;
    try {
      const giteaUrl = config.gitea.url || 'http://localhost:3000';
      const adminToken = config.gitea.token || '';
      const headers = adminToken ? { 'Authorization': adminToken } : {};
      const gr = await fetch(`${giteaUrl}/api/v1/version`, { headers });
      giteaOk = gr.ok;
      if (!gr.ok) console.warn(`[System] Gitea status ${gr.status}: ${await gr.text().catch(()=>'')}`);
    } catch (e) {
      console.warn(`[System] Gitea unreachable: ${e.message}`);
    }
    try {
      await db('user_profiles').count('* as count').first();
      dbOk = true;
    } catch (e) { console.warn('[System] DB check failed:', e.message); }

    res.json({
      code: 200,
      data: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: Math.floor(os.uptime()),
        cpu: { model: cpuModel, cores: cpuCores, usage: cpuUsage },
        memory: { total: totalMem, used: usedMem, free: freeMem, usagePct: Math.round((usedMem / totalMem) * 100) },
        disk: { total: diskTotal, free: diskFree, usagePct: diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0 },
        services: {
          gitea: { url: config.gitea?.url || 'http://localhost:3000', online: giteaOk },
          database: { host: config.database?.host || '', online: dbOk },
        },
      },
    });
  } catch (error) {
    res.json({ code: 200, data: null });
  }
});

export default router;
