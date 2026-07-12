/**
 * 用户登录/登出认证（Gitea 认证 + JWT 签发 + 本地用户同步）
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import db from '../database/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '..', '..', '.env');

const router = Router();

// 登录 — Gitea API 认证 + 本地用户记录同步
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码不能为空',
      });
    }

    // 先尝试 Gitea Basic Auth 验证，失败时用本地密码兜底
    let giteaUser = null;
    let authSource = 'gitea';

    try {
      giteaUser = await authenticateWithGitea(username, password);
    } catch (giteaErr) {
      console.warn('Gitea 认证请求异常，尝试本地认证:', giteaErr.message);
    }

    // Gitea 认证失败 → 尝试本地密码兜底
    if (!giteaUser) {
      const localUser = await db('user_profiles')
        .where(db.raw('LOWER(gitea_username)'), username.toLowerCase())
        .where('is_active', true)
        .first();

      if (localUser && localUser.password_hash) {
        const localMatch = await bcrypt.compare(password, localUser.password_hash);
        if (localMatch) {
          // 本地密码匹配成功！尝试获取 Gitea 用户信息（只读，不需要密码）
          try {
            const adminToken = config.gitea?.token;
            if (adminToken) {
              const authHeader = adminToken.startsWith('Basic ') || adminToken.startsWith('Bearer ')
                ? adminToken
                : `Bearer ${adminToken}`;
              const infoRes = await fetch(`${config.gitea.url}/api/v1/users/${encodeURIComponent(username)}`, {
                headers: { 'Authorization': authHeader }
              });
              if (infoRes.ok) {
                giteaUser = await infoRes.json();
              }
            }
          } catch { /* 静默失败，用本地数据 */ }

          // 如果没能从 Gitea 拿到用户信息，用本地数据构造
          if (!giteaUser) {
            giteaUser = {
              id: localUser.user_id,
              login: localUser.gitea_username,
              full_name: localUser.nickname || localUser.gitea_username,
              email: localUser.email || '',
              avatar_url: '',
              is_admin: localUser.role_code === 'admin',
            };
          }
          authSource = 'local_fallback';
          console.log(`[Auth] 用户 ${username} 通过本地密码认证 (Gitea 认证不可用)`);

          // ════════════════════════════════════════════════════════════
          // 自愈：后台尝试将密码同步到 Gitea，不阻塞本次登录
          // 下次登录就能走 Gitea 认证，不再走本地兜底
          // ════════════════════════════════════════════════════════════
          syncPasswordToGitea(username, password, localUser.role_code).then(synced => {
            if (synced) {
              console.log(`[Auth] 本地认证后自动同步 Gitea 密码成功: ${username}`);
            }
          }).catch(() => {});
        }
      }
    }

    if (!giteaUser) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
      });
    }

    // 检查用户状态（锁定/注销）
    try {
      const statusCheck = await db('user_profiles').where('user_id', giteaUser.id).first();
      if (statusCheck) {
        if (statusCheck.is_active === false) {
          return res.status(403).json({
            code: 403,
            message: '账号已注销，无法登录',
          });
        }
        if (statusCheck.account_locked === true) {
          return res.status(403).json({
            code: 403,
            message: '账号已被锁定，请联系管理员',
          });
        }
      }
    } catch { /* 忽略查询错误 */ }

    // 初始化角色/权限（新用户默认，已有用户从数据库加载）
    let isAdmin = false;
    let role = 'developer';
    let permissions = ['repo:view', 'branch:view', 'version:view'];

    // 角色名映射
    function getRoleName(roleCode) {
      const map = { admin: '系统管理员', project_manager: '项目管理员', developer: '开发人员', auditor: '审计人员' };
      return map[roleCode] || '开发人员';
    }

    // 同步用户信息到本地 user_profiles 表
    let existingUser = null;
    let userIdMatched = true;
    try {
      existingUser = await db('user_profiles').where('user_id', giteaUser.id).first();
      userIdMatched = true;

      // ★ 如果按 user_id 找不到，尝试按 gitea_username 找（统一小写匹配，规避大小写不一致）
      if (!existingUser) {
        existingUser = await db('user_profiles')
          .where(db.raw('LOWER(gitea_username)'), (giteaUser.login || username).toLowerCase())
          .where('is_active', true)
          .first();
        if (existingUser) {
          userIdMatched = false;
          console.log(`[Auth] 用户 ${username} 通过用户名匹配到本地记录（user_id: ${existingUser.user_id} → gitea_id: ${giteaUser.id}）`);
        }
      }

      const now = new Date();

      if (existingUser) {
        // 已有用户：只更新登录时间，不覆盖角色/权限
        const updateTargetId = userIdMatched ? giteaUser.id : existingUser.user_id;
        await db('user_profiles').where('user_id', updateTargetId).update({
          gitea_username: (giteaUser.login || username).toLowerCase(),
          nickname: giteaUser.full_name || username,
          email: giteaUser.email || '',
          last_login_time: now,
          last_login_ip: clientIp,
          updated_at: now,
        });

        // ★ user_id 不匹配时，把本地记录的 user_id 修正为 Gitea 的 ID，保持一致性
        if (!userIdMatched) {
          await db('user_profiles')
            .where('user_id', existingUser.user_id)
            .update({ user_id: giteaUser.id, updated_at: now });
          console.log(`[Auth] 已修正用户 ${username} 的 user_id: ${existingUser.user_id} → ${giteaUser.id}`);
        }

        // 使用数据库中已有的角色和权限
        role = existingUser.role_code || 'developer';
        permissions = await loadRolePermissions(role);
        isAdmin = (role === 'admin');
      } else {
        // 新用户：从 Gitea 推断角色
        role = giteaUser.is_admin === true ? 'admin' : 'developer';
        isAdmin = (role === 'admin');
        permissions = isAdmin ? ['*'] : ['repo:view', 'branch:view', 'version:view'];
        await db('user_profiles').insert({
          user_id: giteaUser.id,
          gitea_username: (giteaUser.login || username).toLowerCase(),
          nickname: giteaUser.full_name || username,
          email: giteaUser.email || '',
          role_code: role,
          department_id: null,
          secret_level: 'internal',
          is_active: true,
          account_locked: false,
          failed_login_attempts: 0,
          permissions: JSON.stringify([]),
          last_login_time: now,
          last_login_ip: clientIp,
          created_at: now,
          updated_at: now,
        });
      }
    } catch (profileError) {
      // 本地用户同步失败不影响登录
      console.warn('同步用户信息失败:', profileError.message);
    }

    const roleName = getRoleName(role);

    // 获取部门名称（用于登录响应）
    let departmentName = '';
    try {
      const deptId = existingUser?.department_id;
      if (deptId) {
        const dept = await db('departments').where('dept_id', deptId).first();
        departmentName = dept?.name || '';
      }
    } catch { /* 忽略 */ }

    // 创建会话记录（先删旧记录，每人只保留一条）
    try {
      await db('sessions').where('user_id', giteaUser.id).delete();
      const sessionId = `SESSION-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await db('sessions').insert({
        session_id: sessionId,
        user_id: giteaUser.id,
        username: giteaUser.login || username,
        ip_address: clientIp,
        user_agent: req.headers['user-agent'] || '',
        created_at: new Date(),
        last_active_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天
      });
    } catch (sessionError) {
      console.warn('创建会话记录失败:', sessionError.message);
    }

    // 为 BFF 代理请求创建 Gitea API Token
    const giteaToken = await createGiteaToken(username, password);
    // 管理员首次登录时将其 Gitea 凭据写入 .env（Basic Auth 格式）供仓库/BFF 接口使用
    if (isAdmin && !config.gitea?.token) {
      try {
        let envContent = fs.readFileSync(ENV_FILE, 'utf8');
        if (envContent.includes('GITEA_ADMIN_TOKEN=')) {
          envContent = envContent.replace(/GITEA_ADMIN_TOKEN=.*/, `GITEA_ADMIN_TOKEN=${giteaToken}`);
        } else {
          envContent += `\nGITEA_ADMIN_TOKEN=${giteaToken}\n`;
        }
        fs.writeFileSync(ENV_FILE, envContent, 'utf8');
        config.gitea.token = giteaToken;
        console.log('[Auth] 管理员 Gitea 凭据已写入 .env');
      } catch (e) {
        console.warn('[Auth] 写入 .env 失败:', e.message);
      }
    }

    // 生成 JWT（包含 Gitea 用户信息和 Gitea Token）
    const token = jwt.sign(
      {
        userId: giteaUser.id,
        username: giteaUser.login || username,
        nickname: giteaUser.full_name || username,
        email: giteaUser.email || '',
        avatarUrl: giteaUser.avatar_url || '',
        roleCode: role,
        isAdmin: isAdmin,
        permissions: permissions,
        giteaToken: giteaToken || '',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: giteaUser.id,
          username: giteaUser.login || username,
          nickname: existingUser?.nickname || giteaUser.full_name || username,
          email: existingUser?.email || giteaUser.email || '',
          avatar: giteaUser.avatar_url || '',
          role: role,
          roleName: roleName,
          departmentName: departmentName,
          departmentId: existingUser?.department_id || null,
          secretLevel: existingUser?.secret_level || 'secret',
          lastLoginTime: existingUser?.last_login_time || null,
          permissions: permissions,
        },
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    next(error);
  }
});

// 登出 — 删除会话记录
router.post('/logout', authenticate, async (req, res) => {
  try {
    await db('sessions').where('user_id', req.user.userId).delete();
  } catch { /* ignore */ }
  res.json({
    code: 200,
    message: '登出成功',
  });
});

// 获取当前用户信息 — 从 JWT 解码
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch {
      return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
    }

    // 从数据库获取完整用户信息（部门、密级、角色名等）
    const profile = await db('user_profiles')
      .select('user_profiles.*', 'departments.name as department_name', 'roles.name as role_name')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .leftJoin('roles', 'user_profiles.role_code', 'roles.code')
      .where('user_id', decoded.userId)
      .first();

    const roleNameMap = { admin: '系统管理员', project_manager: '项目管理员', developer: '开发人员', auditor: '审计人员' };
    const roleCode = profile?.role_code || decoded.roleCode || 'developer';
    const roleName = roleNameMap[roleCode] || profile?.role_name || '开发人员';

    res.json({
      code: 200,
      data: {
        id: decoded.userId,
        username: decoded.username,
        nickname: profile?.nickname || decoded.nickname,
        email: profile?.email || decoded.email || '',
        avatar: decoded.avatarUrl || '',
        role: roleCode,
        roleName,
        departmentName: profile?.department_name || '',
        departmentId: profile?.department_id || null,
        secretLevel: profile?.secret_level || 'secret',
        lastLoginTime: profile?.last_login_time || null,
        permissions: decoded.permissions || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// 通过 Basic Auth 调用 Gitea API 验证用户
async function authenticateWithGitea(username, password) {
  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await fetch(`${config.gitea.url}/api/v1/user`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Gitea 认证失败:', error.message);
    return null;
  }
}

// 从数据库加载角色对应的权限列表
async function loadRolePermissions(roleCode) {
  try {
    const role = await db('roles')
      .where('role_code', roleCode)
      .orWhere('code', roleCode)
      .first();
    if (role && role.permissions) {
      const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
      return Array.isArray(perms) ? perms : ['repo:view', 'branch:view', 'version:view'];
    }
  } catch (e) { /* ignore */ }
  return ['repo:view', 'branch:view', 'version:view'];
}

// 为用户生成 Gitea Basic Auth 凭证（用于 BFF 代理和前端直连 Gitea API）
async function createGiteaToken(username, password) {
  // 直接使用 Basic Auth，无需创建 API Token
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * 后台同步密码到 Gitea（自愈机制）
 * 当用户通过本地密码兜底登录成功时，尝试把密码同步到 Gitea
 * 这样下次登录就能直接走 Gitea，不再走兜底
 */
async function syncPasswordToGitea(username, password, roleCode) {
  try {
    // 优先用配置的管理员 Token，其次用用户自身的凭据
    const giteaAdminToken = config.gitea?.token;
    let authHeader = '';

    if (giteaAdminToken) {
      authHeader = giteaAdminToken.startsWith('Basic ') || giteaAdminToken.startsWith('Bearer ')
        ? giteaAdminToken
        : `Bearer ${giteaAdminToken}`;
    } else if (roleCode === 'admin') {
      // 没有配置管理员 Token，但当前用户是管理员 → 用他自己的凭据
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      authHeader = `Basic ${credentials}`;
    } else {
      // 没有管理员 Token 且当前用户不是管理员 → 尝试用用户自己的凭据直接修改自己密码
      // 部分 Gitea 版本支持用户通过 PATCH /api/v1/user 改自己的密码
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      authHeader = `Basic ${credentials}`;
      const res = await fetch(`${config.gitea.url}/api/v1/user`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ password })
      });
      if (res.ok) return true;
      // 用户自己改密码失败 → 降级尝试用管理员 Token 方式
      // 但如果这里都没 token 了，那就没法了
      return false;
    }

    const giteaUrl = config.gitea.url;
    const res = await fetch(`${giteaUrl}/api/v1/admin/users/${encodeURIComponent(username)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ password, send_notify: false })
    });

    if (res.ok) return true;

    // 如果返回 403（权限不足），尝试用用户自身的 Basic Auth 改自己密码
    if (res.status === 403) {
      const selfCredentials = Buffer.from(`${username}:${password}`).toString('base64');
      const selfRes = await fetch(`${config.gitea.url}/api/v1/user`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${selfCredentials}` },
        body: JSON.stringify({ password })
      });
      return selfRes.ok;
    }

    const errBody = await res.text();
    console.warn(`[Auth] Gitea 密码同步失败: ${res.status} ${errBody}`);
    return false;
  } catch (err) {
    console.warn(`[Auth] Gitea 密码同步异常: ${err.message}`);
    return false;
  }
}

export default router;
export { syncPasswordToGitea };
