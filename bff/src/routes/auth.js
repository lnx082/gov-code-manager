import { Router } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// 登录 — 纯 Gitea API 认证
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

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

    // 生成 JWT（包含 Gitea 用户信息）
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

export default router;
