import { Router } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';
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

    // 通过 Gitea Basic Auth 验证凭据
    const giteaUser = await authenticateWithGitea(username, password);
    if (!giteaUser) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
      });
    }

    // 初始化角色/权限（新用户默认，已有用户从数据库加载）
    let isAdmin = false;
    let role = 'user';
    let permissions = ['repo:view', 'branch:view', 'version:view'];

    // 角色名映射
    function getRoleName(roleCode) {
      const map = { admin: '系统管理员', project_manager: '项目管理员', developer: '开发人员', auditor: '审计人员' };
      return map[roleCode] || '开发人员';
    }

    // 同步用户信息到本地 user_profiles 表
    try {
      const existingUser = await db('user_profiles').where('user_id', giteaUser.id).first();
      const now = new Date();

      if (existingUser) {
        // 已有用户：只更新登录时间，不覆盖角色/权限
        await db('user_profiles').where('user_id', giteaUser.id).update({
          gitea_username: giteaUser.login || username,
          nickname: giteaUser.full_name || username,
          email: giteaUser.email || '',
          last_login_time: now,
          last_login_ip: clientIp,
          updated_at: now,
        });
        // 使用数据库中已有的角色和权限
        role = existingUser.role_code || 'user';
        permissions = await loadRolePermissions(role);
        isAdmin = (role === 'admin');
      } else {
        // 新用户：从 Gitea 推断角色（仅 admin 可识别，其他默认 user）
        role = giteaUser.is_admin === true ? 'admin' : 'user';
        isAdmin = (role === 'admin');
        permissions = isAdmin ? ['*'] : ['repo:view', 'branch:view', 'version:view'];
        await db('user_profiles').insert({
          user_id: giteaUser.id,
          gitea_username: giteaUser.login || username,
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

    // 创建会话记录
    try {
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
          nickname: giteaUser.full_name || username,
          email: giteaUser.email || '',
          avatar: giteaUser.avatar_url || '',
          role: role,
          roleName: roleName,
          permissions: permissions,
        },
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    next(error);
  }
});

// 登出 — JWT 无状态，前端清除 token 即可
router.post('/logout', async (req, res) => {
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
    const roleCode = profile?.role_code || decoded.roleCode || 'user';
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
    const role = await db('roles').where('code', roleCode).first();
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

export default router;
