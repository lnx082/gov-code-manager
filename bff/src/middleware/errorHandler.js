/**
 * 全局错误处理中间件
 *
 * 【功能】统一处理所有未捕获的错误，按错误类型返回对应 HTTP 状态码和错误信息
 *        处理 ValidationError / UnauthorizedError / 数据库唯一冲突(23505) 等
 * 【数据】不操作数据库
 * 【来源】next(error) 传入的错误对象
 */
export function errorHandler(err, req, res, next) {
  console.error('错误:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: 400,
      message: '数据验证失败',
      errors: err.errors,
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      code: 401,
      message: '未授权访问',
    });
  }
  
  if (err.code === '23505') {
    return res.status(409).json({
      code: 409,
      message: '数据已存在',
    });
  }
  
  res.status(err.status || 500).json({
    code: err.status || 500,
    message: err.message || '服务器内部错误',
  });
}
