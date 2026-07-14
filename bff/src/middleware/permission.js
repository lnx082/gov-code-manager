/**
 * 权限检查中间件
 *
 * 【功能】检查用户是否拥有指定权限（支持通配符匹配），
 *        定义了系统全部 25 种权限常量（repo:*/branch:*/audit:*/admin:* 等）
 * 【数据】读取：req.user.roleCode、req.user.permissions
 * 【来源】req.user（JWT 解码后的用户权限列表）
 */
export function permissionMiddleware(requiredPermissions) {
  return async (req, res, next) => {
    try {
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return next();
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          code: 401,
          message: '用户未认证'
        });
      }

      // 管理员拥有所有权限
      if (user.roleCode === 'admin' || user.roleCode === '系统管理员') {
        return next();
      }

      const userPermissions = user.permissions || [];
      const hasPermission = requiredPermissions.some(perm => {
        return userPermissions.includes(perm) || userPermissions.includes('*');
      });

      if (!hasPermission) {
        return res.status(403).json({
          code: 403,
          message: `没有权限访问此功能，需要: ${requiredPermissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        code: 500,
        message: '权限验证失败'
      });
    }
  };
}

/**
 * 权限定义
 */
export const PERMISSIONS = {
  'repo:view': '查看仓库',
  'repo:create': '创建仓库',
  'repo:edit': '编辑仓库',
  'repo:delete': '删除仓库',
  'repo:download': '下载仓库',
  'branch:view': '查看分支',
  'branch:create': '创建分支',
  'branch:delete': '删除分支',
  'branch:merge': '合并分支',
  'version:view': '查看版本',
  'version:create': '创建版本',
  'version:delete': '删除版本',
  'approval:view': '查看审批',
  'approval:create': '创建审批',
  'approval:process': '处理审批',
  'approval:config': '审批配置',
  'baseline:view': '查看基线',
  'baseline:create': '创建基线',
  'baseline:lock': '锁定基线',
  'archive:view': '查看归档',
  'audit:view': '查看审计日志',
  'audit:export': '导出审计报表',
  'user:view': '查看用户',
  'admin:manage': '系统管理',
  'backup:manage': '备份管理'
};
