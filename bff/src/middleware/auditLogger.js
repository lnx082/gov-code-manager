import db from '../database/connection.js';
import crypto from 'crypto';

let lastHash = null;

async function computeHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export async function auditLogger(req, res, next) {
  // 只记录特定操作
  const auditableMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const auditablePaths = ['/auth/login', '/auth/logout', '/approvals', '/versions', '/baselines'];
  
  if (!auditableMethods.includes(req.method) || 
      !auditablePaths.some(p => req.path.includes(p))) {
    return next();
  }
  
  const start = Date.now();
  
  res.on('finish', async () => {
    try {
      const logData = {
        timestamp: new Date(),
        user_id: req.user?.userId || null,
        username: req.user?.username || req.body?.username || null,
        action_type: req.method,
        action_name: `${req.method} ${req.path}`,
        target_type: req.path.split('/')[2] || null,
        request_method: req.method,
        request_path: req.path,
        request_ip: req.ip || req.connection.remoteAddress,
        response_status: res.statusCode,
        response_time_ms: Date.now() - start,
        result: res.statusCode >= 400 ? 'failed' : 'success',
        details: JSON.stringify({
          body: req.body,
          query: req.query,
        }),
      };
      
      // 计算完整性哈希
      const dataHash = await computeHash(logData);
      logData.integrity_hash = dataHash;
      logData.prev_hash = lastHash;
      
      await db('audit_logs').insert(logData);
      lastHash = dataHash;
      
    } catch (error) {
      console.error('审计日志记录失败:', error);
    }
  });
  
  next();
}
