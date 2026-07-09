import { Router } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import db from '../database/connection.js';

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

    // 从 Gitea 用户信息构建权限
    const isAdmin = giteaUser.is_admin === true;
    const role = isAdmin ? 'admin' : 'user';
    const roleName = isAdmin ? '系统管理员' : '普通用户';
    const permissions = isAdmin
      ? ['*']
      : ['repo:view', 'branch:view', 'version:view'];

    // 同步用户信息到本地 user_profiles 表
    try {
      const existingUser = await db('user_profiles').where('user_id', giteaUser.id).first();
      const now = new Date();
      const profileData = {
        gitea_username: giteaUser.login || username,
        nickname: giteaUser.full_name || username,
        email: giteaUser.email || '',
        role_code: role,
        last_login_time: now,
        last_login_ip: clientIp,
        updated_at: now,
      };
      if (existingUser) {
        await db('user_profiles').where('user_id', giteaUser.id).update(profileData);
      } else {
        await db('user_profiles').insert({
          user_id: giteaUser.id,
          ...profileData,
          department_id: null,
          secret_level: 'internal',
          is_active: true,
          account_locked: false,
          failed_login_attempts: 0,
          permissions: JSON.stringify([]),
          created_at: now,
        });
      }
    } catch (profileError) {
      // 本地用户同步失败不影响登录
      console.warn('同步用户信息失败:', profileError.message);
    }

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

    // JWT 中包含完整用户信息
    res.json({
      code: 200,
      data: {
        id: decoded.userId,
        username: decoded.username,
        nickname: decoded.nickname,
        email: decoded.email || '',
        avatar: decoded.avatarUrl || '',
        role: decoded.roleCode,
        roleName: decoded.isAdmin ? '系统管理员' : '普通用户',
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

// 为用户生成 Gitea Basic Auth 凭证（用于 BFF 代理和前端直连 Gitea API）
async function createGiteaToken(username, password) {
  // 直接使用 Basic Auth，无需创建 API Token
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

export default router;
