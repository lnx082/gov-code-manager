/**
 * 审计日志中间件 - 防篡改链版本
 * 记录所有 API 请求到审计日志表
 */
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '../database/connection.js';
import { detectRisks } from '../services/riskDetector.js';

/**
 * 审计日志中间件
 */
export function auditMiddleware(req, res, next) {
  if (req.path === '/health') {
    return next();
  }

  const startTime = Date.now();
  const originalSend = res.send;
  const self = this;

  res.send = function(body) {
    res.send = originalSend;
    const duration = Date.now() - startTime;

    // 异步记录审计日志
    setImmediate(async () => {
      try {
        await recordAuditLog(req, res, body, duration);
      } catch (err) {
        console.error('审计日志记录失败:', err.message);
      }
    });

    return res.send(body);
  };

  next();
}

/**
 * 根据请求方法和路径推断业务操作类型
 */
function determineActionType(method, path) {
  const p = path.toLowerCase();
  // 认证相关
  if (p.includes('/auth/login')) return 'login';
  if (p.includes('/auth/logout')) return 'logout';
  // 仓库相关
  if (p.includes('/repos') && method === 'DELETE') return 'delete';
  if (p.includes('/repos') && method === 'POST') return 'create';
  if (p.includes('/repos') && method === 'PUT') return 'update';
  // 审批相关
  if (p.includes('/approvals') && method === 'POST') return 'approval';
  // 版本相关
  if (p.includes('/versions')) return 'version';
  // 下载
  if (p.includes('/archive') || p.includes('/download') || p.includes('/raw')) return 'download';
  // 合并
  if (p.includes('/merge') || p.includes('/pulls')) return 'merge';
  // 提交
  if (p.includes('/commits')) return 'commit';
  // 方法映射
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  if (method === 'GET') return 'view';
  return method.toLowerCase();
}

/**
 * 记录审计日志
 */
async function recordAuditLog(req, res, body, responseTime) {
  const db = getDb();
  if (!db) {
    console.warn('数据库未连接，跳过审计日志记录');
    return;
  }

  const logId = `AUDIT-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
  
  // 获取上一条日志的哈希值
  let prevHash = null;
  try {
    const result = await db('audit_logs')
      .select('integrity_hash')
      .orderBy('timestamp', 'desc')
      .limit(1);
    if (result && result.length > 0) {
      prevHash = result[0].integrity_hash;
    }
  } catch (err) {
    console.warn('获取上一条日志哈希失败:', err.message);
  }

  // 计算完整性哈希
  const hashInput = logId + JSON.stringify({
    userId: req.user?.userId,
    action: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  }) + (prevHash || '');

  const integrityHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  try {
    // 构建日志数据
    const logData = {
      log_id: logId,
      timestamp: new Date(),
      user_id: req.user?.userId || null,
      // 登录请求时 req.user 不存在，从请求体中提取用户名
      username: req.user?.username || req.body?.username || null,
      nickname: req.user?.nickname || null,
      department_id: req.user?.departmentId || null,
      department_name: req.user?.departmentName || null,
      role_code: req.user?.roleCode || null,
      action_type: determineActionType(req.method, req.originalUrl || req.path),
      action_name: `${req.method} ${req.path}`,
      target_type: req.body?.targetType || null,
      target_id: req.body?.targetId || null,
      target_name: req.body?.targetName || null,
      request_method: req.method,
      request_path: req.originalUrl?.substring(0, 500) || null,
      request_body: JSON.stringify(req.body || {}).substring(0, 4000),
      request_ip: req.ip || req.connection?.remoteAddress || 'unknown',
      request_user_agent: (req.headers['user-agent'] || '').substring(0, 500),
      response_status: res.statusCode,
      response_time_ms: responseTime,
      result: res.statusCode < 400 ? 'success' : 'fail',
      error_message: res.statusCode >= 400 ? (typeof body === 'string' ? body.substring(0, 500) : null) : null,
      session_id: req.user?.sessionId || null,
      integrity_hash: integrityHash,
      prev_hash: prevHash
    };

    await db('audit_logs').insert(logData);
    console.log(`✅ 审计日志已记录: ${logId}`);

    // 异步风险检测，不阻塞审计日志记录
    setImmediate(() => {
      detectRisks(logData).catch(err => {
        console.error('风险检测异常:', err.message);
      });
    });
  } catch (error) {
    console.error('审计日志写入失败:', error.message);
  }
}

/**
 * 验证审计日志链完整性
 */
export async function verifyAuditChain(startLogId, endLogId) {
  const db = getDb();
  if (!db) {
    return { valid: true, message: '数据库未连接' };
  }

  try {
    const logs = await db('audit_logs')
      .whereBetween('log_id', [startLogId, endLogId])
      .orderBy('timestamp', 'asc');

    if (logs.length === 0) {
      return { valid: true, message: '没有找到指定范围的日志' };
    }

    // 验证哈希链
    for (let i = 1; i < logs.length; i++) {
      if (logs[i].prev_hash !== logs[i - 1].integrity_hash) {
        return {
          valid: false,
          brokenAt: logs[i].log_id,
          message: `审计日志链在 ${logs[i].log_id} 处被破坏`
        };
      }
    }

    return { valid: true, message: '审计日志链完整' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

/**
 * 获取审计统计
 */
export async function getAuditStats(startDate, endDate) {
  const db = getDb();
  if (!db) {
    return { total: 0, byAction: [], byUser: [] };
  }

  try {
    let query = db('audit_logs');
    
    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    const [totalResult, byAction, byUser] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().select('action_type').count('* as count').groupBy('action_type'),
      query.clone().select('username').count('* as count').groupBy('username').limit(10)
    ]);

    return {
      total: parseInt(totalResult?.count || 0),
      byAction: byAction || [],
      byUser: byUser || []
    };
  } catch (error) {
    console.error('获取审计统计失败:', error.message);
    return { total: 0, byAction: [], byUser: [] };
  }
}
