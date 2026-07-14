/**
 * 全局错误处理中间件
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
