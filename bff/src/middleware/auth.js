/**
 * JWT 认证中间件 + 权限检查（authenticate/requirePermission/requireAdmin）
 *
 * 【功能】验证 JWT Token 有效性、检查用户状态（是否激活/锁定）、
 *        提供角色检查（requireRole）、管理员检查（requireAdmin）、权限检查（requirePermission）
 *        从服务端凭据存储（credentialStore）注入 giteaToken
 * 【数据】查询：user_profiles（检查用户 is_active / account_locked 状态）
 * 【来源】openGauss（通过 db() 查询 user_profiles）、JWT payload（req.user）
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import db from '../database/connection.js';
import { getCredential } from '../services/credentialStore.js';

export async function authenticate(req, res, next) {
  // 优先从 Authorization 头获取，其次从 query 参数获取（用于 window.open 下载）
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;

    // 检查用户状态（已登录用户也实时生效）
    try {
      const profile = await db('user_profiles').where('user_id', decoded.userId).first();
      if (!profile || profile.is_active === false) {
        return res.status(401).json({ code: 401, message: '用户不存在或已注销' });
      }
      if (profile.account_locked === true) {
        return res.status(403).json({ code: 403, message: '账号已被锁定，无法执行操作' });
      }
    } catch { /* 查询失败不影响正常请求 */ }

    // C-03 修复：从服务端凭据存储注入 giteaToken，JWT 不再携带
    // 下游路由无需修改，继续使用 req.user.giteaToken
    req.user.giteaToken = getCredential(decoded.userId) || '';

    // 兜底：管理员用户可使用全局配置的 admin token
    if (!req.user.giteaToken && (decoded.roleCode === 'admin' || decoded.isAdmin)) {
      req.user.giteaToken = config.gitea?.token || '';
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '令牌已过期',
      });
    }
    return res.status(401).json({
      code: 401,
      message: '无效的令牌',
    });
  }
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: '未登录',
      });
    }
    
    // 管理员拥有所有权限
    if (req.user.roleCode === 'admin' || req.user.permissions?.includes('*')) {
      return next();
    }
    
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(p => 
      userPermissions.includes(p) || 
      userPermissions.some(up => up.endsWith('*') && p.startsWith(up.slice(0, -1)))
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: '没有权限执行此操作',
      });
    }
    
    next();
  };
}

// 角色检查中间件（允许指定角色列表访问）
// auditor 和 security_auditor 视为等价
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }

    const userRole = req.user.roleCode || 'user';
    const auditRoles = ['auditor', 'security_auditor'];

    // 检查用户角色是否在允许列表中（auditor 双向等价匹配）
    const matched = roles.some(r =>
      r === userRole ||
      (auditRoles.includes(r) && auditRoles.includes(userRole))
    );

    if (req.user.permissions?.includes('*')) return next();
    if (userRole === 'admin') return next(); // 管理员始终放行

    if (!matched) {
      return res.status(403).json({ code: 403, message: '没有权限执行此操作' });
    }
    next();
  };
}

// 管理员权限检查中间件
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      code: 401,
      message: '未登录',
    });
  }
  
  // 检查是否是管理员
  if (req.user.roleCode === 'admin' || req.user.permissions?.includes('*')) {
    return next();
  }
  
  return res.status(403).json({
    code: 403,
    message: '需要管理员权限',
  });
}
