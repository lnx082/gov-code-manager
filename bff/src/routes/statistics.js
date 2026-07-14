/**
 * 仪表盘统计数据 + 趋势数据
 */
import { Router } from 'express';
import os from 'os';
import { execSync } from 'child_process';
import db from '../database/connection.js';
import config from '../config/index.js';
import { authenticate } from '../middleware/auth.js';
import { filterMyPending } from './approvals.js';

const router = Router();

// 获取仪表盘统计
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.roleCode === 'admin';

    // 待审批数 — 复用 approvals.js 的共享过滤函数（批量加载，按审批步骤角色过滤）
    let pendingApprovals = 0;
    try {
      const allPending = await db('approvals').where('status', 'pending').select('*');
      const myPending = await filterMyPending(allPending, req.user);
      pendingApprovals = myPending.length;
    } catch { /* ignore */ }

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
    const days = parseInt(req.query.days) || 7;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const nextDateStr = new Date(d.getTime() + 86400000).toISOString().split('T')[0];

      // 从 audit_logs 统计当日操作数（commits）
      let commits = 0;
      try {
        const commitCount = await db('audit_logs')
          .where('timestamp', '>=', dateStr)
          .where('timestamp', '<', nextDateStr)
          .count('* as count').first();
        commits = parseInt(commitCount?.count || 0);
      } catch { /* ignore */ }

      // 从 approvals 统计当日版本发布数
      let versions = 0;
      try {
        const versionCount = await db('approvals')
          .where('created_at', '>=', dateStr)
          .where('created_at', '<', nextDateStr)
          .where('operation_type', 'version_release')
          .count('* as count').first();
        versions = parseInt(versionCount?.count || 0);
      } catch { /* ignore */ }

      // 从 approvals 统计当日审批数
      let approvals = 0;
      try {
        const approvalCount = await db('approvals')
          .where('created_at', '>=', dateStr)
          .where('created_at', '<', nextDateStr)
          .count('* as count').first();
        approvals = parseInt(approvalCount?.count || 0);
      } catch { /* ignore */ }

      data.push({ date: dateStr, commits, versions, approvals });
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
