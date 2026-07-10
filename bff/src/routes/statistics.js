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
      const giteaUrl = config.gitea.url || 'http://123.60.219.19:3000';
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
          gitea: { url: config.gitea?.url || 'http://123.60.219.19:3000', online: giteaOk },
          database: { host: config.database?.host || '', online: dbOk },
        },
      },
    });
  } catch (error) {
    res.json({ code: 200, data: null });
  }
});

export default router;
