/**
 * 部门数据隔离中间件
 *
 * 【功能】非管理员用户只能访问本部门数据，将用户 departmentId 注入查询参数
 * 【数据】读取：req.user.roleCode（判断是否为管理员）
 * 【来源】req.user（JWT 解码后的用户信息）
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
