import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import config from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// 登录
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码不能为空',
      });
    }
    
    // 1. 优先从本地数据库查找用户
    let profile = await db('user_profiles')
      .select('user_profiles.*', 'departments.name as department_name')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .where('gitea_username', username)
      .first();
    
    // 2. 如果本地没有用户，尝试从 Gitea 获取用户信息并创建本地用户
    if (!profile) {
      // 尝试从 Gitea 获取用户信息
      const giteaUser = await fetchGiteaUser(username);
      
      if (giteaUser) {
        // Gitea 用户存在，尝试验证密码
        const isValidGitea = await verifyGiteaPassword(username, password);
        
        if (isValidGitea) {
          // Gitea 密码正确，创建本地用户profile
          const defaultRole = await db('roles').where('role_code', 'developer').first();
          
          const [profileId] = await db('user_profiles').insert({
            gitea_username: username,
            nickname: giteaUser.full_name || username,
            role_code: defaultRole?.role_code || 'user',
            department_id: null,
            secret_level: 'internal',
            is_active: true,
            created_at: new Date(),
          });
          
          profile = {
            profile_id: profileId,
            gitea_username: username,
            nickname: giteaUser.full_name || username,
            role_code: defaultRole?.role_code || 'user',
            department_id: null,
            department_name: null,
            secret_level: 'internal',
            is_active: true,
            account_locked: false,
          };
        } else {
          return res.status(401).json({
            code: 401,
            message: '用户名或密码错误',
          });
        }
      } else {
        // Gitea 用户也不存在，返回错误
        return res.status(401).json({
          code: 401,
          message: '用户名或密码错误',
        });
      }
    } else {
      // 本地用户存在，验证密码
      // 如果用户设置了本地密码，使用本地密码验证
      if (profile.password_hash) {
        const isValid = await bcrypt.compare(password, profile.password_hash);
        if (!isValid) {
          return res.status(401).json({
            code: 401,
            message: '用户名或密码错误',
          });
        }
      } else {
        // 没有本地密码，尝试使用 Gitea 验证
        const isValidGitea = await verifyGiteaPassword(username, password);
        if (!isValidGitea) {
          return res.status(401).json({
            code: 401,
            message: '用户名或密码错误',
          });
        }
      }
    }
    
    // 3. 检查账户是否被锁定
    if (profile.account_locked) {
      return res.status(403).json({
        code: 403,
        message: '账户已被锁定，请联系管理员',
      });
    }
    
    // 4. 检查账户是否启用
    if (!profile.is_active) {
      return res.status(403).json({
        code: 403,
        message: '账户已被禁用，请联系管理员',
      });
    }
    
    // 5. 创建会话
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期
    
    await db('sessions').insert({
      session_id: sessionId,
      user_id: profile.profile_id,
      username: username,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      created_at: new Date(),
      last_active_at: new Date(),
      expires_at: expiresAt,
    });
    
    // 6. 更新最后登录信息
    await db('user_profiles')
      .where('profile_id', profile.profile_id)
      .update({
        last_login_ip: req.ip,
        last_login_time: new Date(),
        failed_login_attempts: 0,
        updated_at: new Date(),
      });
    
    // 7. 获取用户权限
    const permissions = await getUserPermissions(profile.profile_id, profile.role_code);
    
    // 8. 获取角色信息
    const role = await db('roles').where('role_code', profile.role_code).first();
    
    // 9. 生成 JWT
    const token = jwt.sign(
      {
        userId: profile.profile_id,
        username: username,
        nickname: profile.nickname,
        roleCode: profile.role_code,
        departmentId: profile.department_id,
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
        sessionId,
        user: {
          id: profile.profile_id,
          username,
          nickname: profile.nickname,
          role: profile.role_code,
          roleName: role?.role_name || '未知角色',
          permissions: permissions,
          departmentId: profile.department_id,
          departmentName: profile.department_name,
        },
        expiresAt: expiresAt.toISOString(),
      },
    });
    
  } catch (error) {
    console.error('登录错误:', error);
    next(error);
  }
});

// 登出
router.post('/logout', async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (sessionId) {
      await db('sessions').where('session_id', sessionId).delete();
    }
    
    res.json({
      code: 200,
      message: '登出成功',
    });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const profile = await db('user_profiles')
      .select('user_profiles.*', 'departments.name as department_name')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .where('profile_id', decoded.userId)
      .first();
    
    if (!profile) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    
    const role = await db('roles').where('role_code', profile.role_code).first();
    const permissions = await getUserPermissions(profile.profile_id, profile.role_code);
    
    res.json({
      code: 200,
      data: {
        id: profile.profile_id,
        username: profile.gitea_username,
        nickname: profile.nickname,
        role: profile.role_code,
        roleName: role?.role_name || '未知角色',
        permissions: permissions,
        departmentId: profile.department_id,
        departmentName: profile.department_name,
        secretLevel: profile.secret_level,
        lastLoginTime: profile.last_login_time,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
    }
    next(error);
  }
});

// Gitea 回调
router.get('/gitea/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ code: 400, message: '缺少授权码' });
    }
    
    // 使用授权码获取 Gitea token
    // 此处简化处理，实际需要与 Gitea OAuth2 集成
    
    res.json({
      code: 200,
      message: 'Gitea 授权成功',
    });
  } catch (error) {
    next(error);
  }
});

// 辅助函数
async function fetchGiteaUser(username) {
  try {
    const response = await fetch(`${config.gitea.url}/api/v1/users/${username}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取 Gitea 用户失败:', error);
    return null;
  }
}

async function verifyGiteaPassword(username, password) {
  try {
    // 使用 Gitea API 验证用户名密码
    // Gitea 支持 Basic Auth 验证
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    const response = await fetch(`${config.gitea.url}/api/v1/user`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('验证 Gitea 密码失败:', error);
    return false;
  }
}

async function getUserPermissions(userId, roleCode) {
  // 管理员拥有所有权限
  if (roleCode === 'admin') {
    return ['*'];
  }
  
  const role = await db('roles').where('role_code', roleCode).first();
  if (!role || !role.permissions) return [];
  
  // 如果 permissions 是字符串（JSON），则解析
  if (typeof role.permissions === 'string') {
    try {
      return JSON.parse(role.permissions);
    } catch {
      return [];
    }
  }
  
  return role.permissions || [];
}

export default router;
