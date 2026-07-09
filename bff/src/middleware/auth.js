import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌',
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
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
