/**
 * 部门数据隔离中间件
 */
export function deptIsolation(req, res, next) {
  // 如果是管理员或系统管理员，跳过部门隔离
  if (req.user?.roleCode === 'admin' || req.user?.roleCode === 'project_manager') {
    return next();
  }
  
  // 将用户部门ID注入到查询参数
  req.query.departmentId = req.user?.departmentId;
  
  next();
}
