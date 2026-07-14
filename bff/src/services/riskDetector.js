/**
 * 风险检测引擎 — 审计日志写入后异步触发规则检查，生成风险预警
 *
 * 检测规则：
 *   1. 异常登录 (login_abnormal)  — 同IP 5分钟内登录失败≥5次 / 同用户5分钟内≥3次
 *   2. 高频下载 (download_frequent) — 同用户1小时内下载≥20次
 *   3. 越权访问 (permission_violation) — 收到403响应（30分钟内同用户+同路径去重）
 *   4. 数据外泄 (data_leak) — 同IP 1小时内访问≥10个不同仓库
 *
 * 设计原则：每个规则独立 try-catch，一个失败不影响其他规则执行
 * rule_threshold 用数字类型（兼容 PostgreSQL numeric 列）
 */
import { getDb } from '../database/connection.js';

let _db = null;
function db() {
  if (!_db) _db = getDb();
  return _db;
}

// ============================================================
// 主入口
// ============================================================

/**
 * 风险检测入口 —— 在审计日志写入后异步调用，不阻塞主流程
 * @param {object} entry - 刚写入 audit_logs 的记录
 */
export async function detectRisks(entry) {
  if (!entry || !db()) return;

  await Promise.allSettled([
    checkLoginAbnormal(entry),
    checkDownloadFrequent(entry),
    checkPermissionViolation(entry),
    checkDataLeak(entry),
  ]);
}

// ============================================================
// 规则1：异常登录
// ============================================================

async function checkLoginAbnormal(entry) {
  try {
    if (entry.action_type !== 'login' || entry.result !== 'fail') return;
    if (!entry.request_ip || entry.request_ip === 'unknown') return;

    const database = db();
    const ip = entry.request_ip;
    const username = entry.username;

    const [ipResult, userResult] = await Promise.all([
      database('audit_logs')
        .where('request_ip', ip)
        .where('action_type', 'login')
        .where('result', 'fail')
        .where('timestamp', '>=', new Date(Date.now() - 5 * 60 * 1000))
        .count('* as count')
        .first(),
      username
        ? database('audit_logs')
            .where('username', username)
            .where('action_type', 'login')
            .where('result', 'fail')
            .where('timestamp', '>=', new Date(Date.now() - 5 * 60 * 1000))
            .count('* as count')
            .first()
        : Promise.resolve(null),
    ]);

    const ipCount = parseInt(ipResult?.count || 0, 10);
    const userCount = parseInt(userResult?.count || 0, 10);

    if (ipCount >= 5) {
      const dup = await database('risk_warnings')
        .where('type', 'login_abnormal')
        .where('source_ip', ip)
        .where('triggered_rule', 'login_abnormal_ip')
        .where('status', 'unhandled')
        .where('created_at', '>=', new Date(Date.now() - 5 * 60 * 1000))
        .first();
      if (!dup) {
        await insertWarning({
          level: 'high',
          type: 'login_abnormal',
          title: `异常登录告警 - ${ip}`,
          description: `IP ${ip} 在5分钟内登录失败 ${ipCount} 次，可能正在遭受暴力破解攻击`,
          related_user_id: entry.user_id || null,
          related_username: entry.username || null,
          source_ip: ip,
          triggered_rule: 'login_abnormal_ip',
          triggered_value: String(ipCount),
          rule_threshold: 5,
        });
        console.log(`[风险检测] 异常登录(IP): ${ip} → ${ipCount}次/5min`);
      }
    }

    if (userCount >= 3) {
      const dup = await database('risk_warnings')
        .where('type', 'login_abnormal')
        .where('related_username', username)
        .where('triggered_rule', 'login_abnormal_user')
        .where('status', 'unhandled')
        .where('created_at', '>=', new Date(Date.now() - 5 * 60 * 1000))
        .first();
      if (!dup) {
        await insertWarning({
          level: 'high',
          type: 'login_abnormal',
          title: `异常登录告警 - ${username}`,
          description: `用户 ${username} 在5分钟内登录失败 ${userCount} 次，账号可能被暴力破解`,
          related_user_id: entry.user_id || null,
          related_username: username,
          source_ip: ip,
          triggered_rule: 'login_abnormal_user',
          triggered_value: String(userCount),
          rule_threshold: 3,
        });
        console.log(`[风险检测] 异常登录(用户): ${username} → ${userCount}次/5min`);
      }
    }
  } catch (err) {
    console.error('[风险检测] 异常登录检测失败:', err.message);
  }
}

// ============================================================
// 规则2：高频下载
// ============================================================

async function checkDownloadFrequent(entry) {
  try {
    if (entry.action_type !== 'download') return;
    if (!entry.user_id) return;

    const database = db();
    const userId = entry.user_id;
    const username = entry.username || '-';

    const result = await database('audit_logs')
      .where('user_id', userId)
      .where('action_type', 'download')
      .where('timestamp', '>=', new Date(Date.now() - 60 * 60 * 1000))
      .count('* as count')
      .first();

    const count = parseInt(result?.count || 0, 10);
    if (count < 20) return;

    const dup = await database('risk_warnings')
      .where('type', 'download_frequent')
      .where('related_user_id', userId)
      .where('status', 'unhandled')
      .where('created_at', '>=', new Date(Date.now() - 60 * 60 * 1000))
      .first();
    if (dup) return;

    await insertWarning({
      level: 'medium',
      type: 'download_frequent',
      title: `高频下载告警 - ${username}`,
      description: `用户 ${username} 在1小时内执行了 ${count} 次下载操作，可能存在数据批量外传风险`,
      related_user_id: userId,
      related_username: username,
      source_ip: entry.request_ip || null,
      triggered_rule: 'download_frequent',
      triggered_value: String(count),
      rule_threshold: 20,
    });
    console.log(`[风险检测] 高频下载: ${username} → ${count}次/小时`);
  } catch (err) {
    console.error('[风险检测] 高频下载检测失败:', err.message);
  }
}

// ============================================================
// 规则3：越权访问
// ============================================================

async function checkPermissionViolation(entry) {
  try {
    if (entry.response_status !== 403) return;
    if (!entry.user_id) return;
    if (entry.role_code === 'admin') return;

    const database = db();
    const userId = entry.user_id;
    const username = entry.username || '-';
    const path = entry.request_path || '-';

    const dup = await database('risk_warnings')
      .where('type', 'permission_violation')
      .where('related_user_id', userId)
      .where('triggered_value', path)
      .where('status', 'unhandled')
      .where('created_at', '>=', new Date(Date.now() - 30 * 60 * 1000))
      .first();
    if (dup) return;

    await insertWarning({
      level: 'medium',
      type: 'permission_violation',
      title: `越权访问告警 - ${username}`,
      description: `用户 ${username}（角色: ${entry.role_code || '未知'}）尝试访问未授权资源 ${path}，返回403禁止访问`,
      related_user_id: userId,
      related_username: username,
      source_ip: entry.request_ip || null,
      triggered_rule: 'permission_violation',
      triggered_value: path,
      rule_threshold: 1,
    });
    console.log(`[风险检测] 越权访问: ${username} → ${path} (403)`);
  } catch (err) {
    console.error('[风险检测] 越权访问检测失败:', err.message);
  }
}

// ============================================================
// 规则4：数据外泄风险
// ============================================================

async function checkDataLeak(entry) {
  try {
    if (!entry.request_ip || entry.request_ip === 'unknown') return;

    const path = entry.request_path || '';
    const isRepoRelated =
      path.includes('/repos') ||
      path.includes('/branches') ||
      path.includes('/archive') ||
      path.includes('/download') ||
      path.includes('/raw') ||
      entry.action_type === 'download' ||
      entry.action_type === 'view';
    if (!isRepoRelated) return;

    const database = db();
    const ip = entry.request_ip;

    // 1小时内同IP访问的不同仓库数（用 JS Set 去重，兼容不同数据库）
    const rows = await database('audit_logs')
      .select('target_name')
      .where('request_ip', ip)
      .whereNotNull('target_name')
      .where('target_name', '!=', '')
      .where('timestamp', '>=', new Date(Date.now() - 60 * 60 * 1000));
    const distinctRepos = new Set((rows || []).map(r => r.target_name)).size;
    if (distinctRepos < 10) return;

    const dup = await database('risk_warnings')
      .where('type', 'data_leak')
      .where('source_ip', ip)
      .where('status', 'unhandled')
      .where('created_at', '>=', new Date(Date.now() - 60 * 60 * 1000))
      .first();
    if (dup) return;

    await insertWarning({
      level: 'high',
      type: 'data_leak',
      title: `数据外泄风险 - ${ip}`,
      description: `IP ${ip} 在1小时内访问了 ${distinctRepos} 个不同仓库（当前: ${entry.target_name || path}），存在批量数据外泄嫌疑`,
      related_user_id: entry.user_id || null,
      related_username: entry.username || null,
      source_ip: ip,
      triggered_rule: 'data_leak',
      triggered_value: String(distinctRepos),
      rule_threshold: 10,
    });
    console.log(`[风险检测] 数据外泄: ${ip} → ${distinctRepos}个仓库/小时`);
  } catch (err) {
    console.error('[风险检测] 数据外泄检测失败:', err.message);
  }
}

// ============================================================
// 工具函数
// ============================================================

async function insertWarning(payload) {
  try {
    const database = db();
    if (!database) return;
    await database('risk_warnings').insert({
      ...payload,
      status: 'unhandled',
      created_at: new Date(),
    });
  } catch (err) {
    console.error('[风险检测] 预警插入失败:', err.message);
  }
}
