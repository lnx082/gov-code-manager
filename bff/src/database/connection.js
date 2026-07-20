/**
 * 数据库连接模块 - 支持 openGauss (兼容 PostgreSQL 协议)
 *
 * 【功能】创建并管理 openGauss 数据库连接池，提供自动建表迁移、表结构修复、种子数据插入
 * 【数据】所有业务表（users / roles / approvals / audit_logs 等 15 张表）
 * 【来源】配置取自 ../config/index.js（从 .env 读取 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD）
 *         DB 连接失败时自动降级为内存模拟数据库（createMockDb）
 */
import knex from 'knex';
import config from '../config/index.js';
import { createRequire } from 'module';

// ─── openGauss 兼容 ───
// openGauss version() 返回 "(openGauss 5.0.0 build ...)" 而非 "PostgreSQL ..."
// 这里 monkey-patch knex 的 pg 驱动，使其能解析 openGauss 的版本号格式
const require = createRequire(import.meta.url);
const Client_PG = require('knex/lib/dialects/postgres/index.js');
Client_PG.prototype._parseVersion = function (versionString) {
  if (!versionString || typeof versionString !== 'string') return 'unknown';
  const pgMatch = /^PostgreSQL (.*?)( |$)/.exec(versionString);
  if (pgMatch) return pgMatch[1];
  const ogMatch = /openGauss (\S+)/.exec(versionString);
  if (ogMatch) return ogMatch[1];
  const fallback = /\(?([\w]+)\s+([\d.]+)/.exec(versionString);
  if (fallback) return fallback[2];
  return 'unknown';
};

// 数据库连接实例（全局单例）
let db = null;
let dbInitialized = false;

/**
 * 检查并修复数据库表结构
 *
 * 【功能】扫描所有表缺失的列并自动添加，插入默认角色/部门数据，迁移旧数据格式
 * 【数据】user_profiles / roles / departments / sessions 等表的列定义
 * 【来源】连接已建立的 openGauss 实例（参数 database）
 */
async function fixDatabaseSchema(database) {
  console.log('🔍 检查数据库表结构...');

  // ─── 需要检查的缺失列清单 ───
  // 每张表可能因版本迭代缺少某些列，这里逐个检查并补全
  const tableColumns = {
    user_profiles: [
      { name: 'account_locked', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'failed_login_attempts', def: 'INTEGER DEFAULT 0' },
      { name: 'last_login_ip', def: 'VARCHAR(50)' },
      { name: 'last_login_time', def: 'TIMESTAMP' },
      { name: 'locked_until', def: 'TIMESTAMP' },
      { name: 'email', def: 'VARCHAR(255)' },
      { name: 'password_hash', def: 'VARCHAR(255)' },
      { name: 'secret_level', def: 'VARCHAR(20) DEFAULT \'internal\'' },
      { name: 'permissions', def: 'TEXT' },
    ],
    roles: [
      { name: 'sort_order', def: 'INTEGER DEFAULT 0' },
      { name: 'is_system', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
      // 兼容两套列名：老版本用 code/name，新版本用 role_code/role_name
      { name: 'code', def: 'VARCHAR(50)' },
      { name: 'name', def: 'VARCHAR(100)' },
      { name: 'role_code', def: 'VARCHAR(50)' },
      { name: 'role_name', def: 'VARCHAR(100)' },
    ],
    departments: [
      { name: 'sort_order', def: 'INTEGER DEFAULT 0' },
      { name: 'parent_id', def: 'INTEGER' },
      { name: 'leader', def: 'VARCHAR(100)' },
      { name: 'description', def: 'TEXT' },
      { name: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
    ],
    sessions: [
      { name: 'ip_address', def: 'VARCHAR(50)' },
      { name: 'user_agent', def: 'VARCHAR(500)' },
      { name: 'last_active_at', def: 'TIMESTAMP' },
    ],
  };

  // 遍历每张表的每个列，缺失则 ADD COLUMN
  for (const [tableName, columns] of Object.entries(tableColumns)) {
    for (const col of columns) {
      try {
        const result = await database.raw(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${tableName}' AND column_name = '${col.name}'
        `);
        if (result.rows.length === 0) {
          console.log(`  ➕ 添加列: ${tableName}.${col.name}`);
          await database.raw(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.def}`);
          console.log(`  ✅ ${tableName}.${col.name} 添加成功`);
        }
      } catch (err) {
        console.warn(`  ⚠️  添加列 ${tableName}.${col.name} 失败: ${err.message}`);
      }
    }
  }

  // ─── 双向回填 roles 表的两套列名 ───
  // 老数据可能只有 code/name（新列 role_code/role_name 为空），反之亦然
  // 这里做双向拷贝确保 JOIN 查询不受影响
  try {
    await database.raw("UPDATE roles SET code = role_code WHERE code IS NULL AND role_code IS NOT NULL");
    await database.raw("UPDATE roles SET role_code = code WHERE role_code IS NULL AND code IS NOT NULL");
    await database.raw("UPDATE roles SET name = role_name WHERE name IS NULL AND role_name IS NOT NULL");
    await database.raw("UPDATE roles SET role_name = name WHERE role_name IS NULL AND name IS NOT NULL");
  } catch (err) {
    console.warn(`  ⚠️  回填 roles 列数据失败: ${err.message}`);
  }

  // ─── 插入默认角色（仅首次启动时）───
  try {
    const rolesCount = await database('roles').count('* as count').first();
    if (parseInt(rolesCount.count) === 0) {
      console.log('  📥 插入默认角色...');
      await database('roles').insert([
        { role_code: 'admin', role_name: '系统管理员', description: '系统管理员，拥有全部权限', permissions: '["*"]', is_system: true, sort_order: 1 },
        { role_code: 'project_manager', role_name: '项目管理员', description: '项目管理员，负责项目管理', permissions: '["repo:*", "branch:*", "version:*", "approval:*", "baseline:*"]', is_system: true, sort_order: 2 },
        { role_code: 'developer', role_name: '开发人员', description: '开发人员，负责代码开发', permissions: '["repo:view", "repo:create", "branch:*", "version:view", "approval:create"]', is_system: true, sort_order: 3 },
        { role_code: 'auditor', role_name: '审计人员', description: '审计人员，负责审计监督', permissions: '["audit:*"]', is_system: true, sort_order: 4 },
      ]);
      console.log('  ✅ 默认角色插入成功');
    }
  } catch (err) {
    console.warn(`  ⚠️  插入默认角色失败: ${err.message}`);
  }

  // ─── 插入默认部门 ───
  try {
    const deptsCount = await database('departments').count('* as count').first();
    if (parseInt(deptsCount.count) === 0) {
      console.log('  📥 插入默认部门...');
      await database('departments').insert([
        { name: '技术部', code: 'TECH', description: '技术研发部门', sort_order: 1 },
        { name: '运维部', code: 'OPS', description: '运维保障部门', sort_order: 2 },
        { name: '安全部', code: 'SEC', description: '安全审计部门', sort_order: 3 },
        { name: '综合部', code: 'ADMIN', description: '综合管理部门', sort_order: 4 }
      ]);
      console.log('  ✅ 默认部门插入成功');
    }
  } catch (err) {
    console.warn(`  ⚠️  插入默认部门失败: ${err.message}`);
  }

  // ─── 数据迁移：secret_level 旧值 internal → secret ───
  try {
    const updated = await database('user_profiles')
      .where('secret_level', 'internal')
      .update({ secret_level: 'secret', updated_at: new Date() });
    if (updated > 0) {
      console.log(`  🔄 已迁移 ${updated} 条用户保密权限：internal → secret`);
    }
  } catch (err) {
    console.warn(`  ⚠️  迁移 secret_level 失败: ${err.message}`);
  }

  // 删除已废弃的"普通用户"角色
  try {
    await database('roles').where('code', 'user').delete();
  } catch (err) {
    console.warn(`  ⚠️  删除废弃角色失败: ${err.message}`);
  }

  // ─── 创建 repo_metadata 表 ───
  // 用于存储仓库→部门→密级的映射关系及中文显示名
  try {
    await database.raw(`
      CREATE TABLE IF NOT EXISTS repo_metadata (
        repo_owner VARCHAR(100) NOT NULL,
        repo_name VARCHAR(100) NOT NULL,
        department_id INTEGER,
        secret_level VARCHAR(20) DEFAULT 'internal',
        display_name VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (repo_owner, repo_name)
      )
    `);
    console.log('✅ repo_metadata 表已就绪');
  } catch (err) {
    console.warn('  ⚠️  创建 repo_metadata 表失败:', err.message);
  }

  console.log('✅ 数据库表结构检查完成');
}

/**
 * 初始化数据库连接
 *
 * 【功能】创建 knex 连接池连接 openGauss，测试连通性
 * 【数据】无（仅建立连接，不查询具体表）
 * 【来源】config.database 中的 host/port/database/user/password
 *         连接失败时自动启用 createMockDb() 模拟数据库
 */
export async function initDatabase() {
  if (dbInitialized && db) return db;

  console.log('📦 初始化 openGauss 数据库连接...');
  console.log(`   主机: ${config.database.host}`);
  console.log(`   端口: ${config.database.port}`);
  console.log(`   数据库: ${config.database.database}`);

  try {
    db = knex({
      client: 'pg',
      connection: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        user: config.database.user,
        password: config.database.password,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
      },
      pool: { min: 2, max: 10, acquireTimeoutMillis: 30000 }
    });

    await db.raw('SELECT version()');
    console.log('✅ 数据库连接成功');
    dbInitialized = true;
    return db;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('⚠️  将使用模拟数据模式运行');
    db = createMockDb();
    dbInitialized = true;
    return db;
  }
}

/**
 * 获取数据库实例（供其他模块调用）
 */
export function getDb() {
  if (!db) initDatabase();
  return db;
}

/**
 * 默认导出，兼容 db('table_name') 调用方式
 */
export default function getDefaultDb(tableName) {
  const instance = getDb();
  return tableName ? instance(tableName) : instance;
}

/**
 * 测试数据库连接
 */
export async function testConnection() {
  try {
    const database = getDb();
    if (!database) return false;
    await database.raw('SELECT version()');
    return true;
  } catch { return false; }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase() {
  if (db) { await db.destroy(); db = null; dbInitialized = false; }
}

/**
 * 创建内存模拟数据库（开发/演示模式）
 */
function createMockDb() {
  const mockTables = { user_profiles: [], roles: [], departments: [], approvals: [], audit_logs: [], baselines: [], archives: [], notifications: [], risk_warnings: [], version_rules: [], approval_flows: [], system_config: [] };

  function makeThenable(fn) {
    return { then(resolve) { resolve(fn()); }, catch(reject) { this.then(null, reject); } };
  }

  function getBuilder(tableName) {
    const data = mockTables[tableName] || [];
    const ops = {
      _where: [], _orderBy: null, _orderDir: 'asc', _limit: null, _offset: null,
      clone() { const b = getBuilder(tableName); b._where = [...this._where]; return b; },
      where(col, val) { const b = this.clone(); b._where.push({ col, val }); return b; },
      orderBy(col, dir) { const b = this.clone(); b._orderBy = col; b._orderDir = dir || 'asc'; return b; },
      limit(v) { const b = this.clone(); b._limit = v; return b; },
      offset(v) { const b = this.clone(); b._offset = v; return b; },
      first() { return makeThenable(() => { const r = this.apply(); return r.length > 0 ? r[0] : null; }); },
      count() { return makeThenable(() => ({ count: String(this.apply().length) })); },
      insert(arr) { return makeThenable(() => { const items = Array.isArray(arr) ? arr : [arr]; items.forEach(item => mockTables[tableName].push({ ...item, created_at: new Date(), updated_at: new Date() })); return [mockTables[tableName].length]; }); },
      update(data) { return makeThenable(() => { this.apply().forEach(r => Object.assign(r, data, { updated_at: new Date() })); return 1; }); },
      delete() { return makeThenable(() => { const items = this.apply(); items.forEach(item => { const idx = mockTables[tableName].indexOf(item); if (idx >= 0) mockTables[tableName].splice(idx, 1); }); return items.length; }); },
      apply() {
        let r = [...(mockTables[tableName] || [])];
        this._where.forEach(w => { r = r.filter(item => item[w.col] == w.val); });
        return r;
      },
      then(resolve) { resolve(this.apply()); },
      catch(reject) { this.then(null, reject); }
    };
    return ops;
  }

  const fn = (table) => getBuilder(table);
  fn.table = (table) => getBuilder(table);
  fn.raw = () => Promise.resolve({ rows: [] });
  fn.destroy = () => Promise.resolve();
  return fn;
}

/**
 * 执行数据库迁移（创建表和修复结构）
 * fixDatabaseSchema 已在启动时调用，此函数供外部模块引用
 */
export async function runMigrations() {
  const database = getDb();
  if (!database) { console.warn('⚠️  数据库未连接，跳过迁移'); return; }
  console.log('🔄 开始执行数据库迁移...');

  // 1. 先建表（确保表存在）
  const tables = [
    `CREATE TABLE IF NOT EXISTS approval_flows (flow_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, applicable_operations TEXT[], applicable_secret_levels TEXT[], steps TEXT[], is_default BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT TRUE, created_by INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS approvals (approval_id SERIAL PRIMARY KEY, operation_type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT, repo_owner VARCHAR(100), repo_name VARCHAR(100), source_branch VARCHAR(100), target_branch VARCHAR(100), gitea_pr_number INTEGER, secret_level VARCHAR(20) DEFAULT 'internal', urgency VARCHAR(20) DEFAULT 'normal', status VARCHAR(20) DEFAULT 'pending', current_step INTEGER DEFAULT 1, approval_flow_id INTEGER, applicant_user_id INTEGER NOT NULL, applicant_username VARCHAR(100) NOT NULL, reviewers TEXT, attachments TEXT, compliance_checklist TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS approval_records (record_id SERIAL PRIMARY KEY, approval_id INTEGER NOT NULL, step INTEGER NOT NULL, step_name VARCHAR(100), reviewer_user_id INTEGER, action VARCHAR(20) NOT NULL, comment TEXT, action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS baselines (baseline_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, version VARCHAR(50) NOT NULL, repo_owner VARCHAR(100) NOT NULL, repo_name VARCHAR(100) NOT NULL, tag_name VARCHAR(100) NOT NULL, description TEXT, status VARCHAR(20) DEFAULT 'active', lock_status VARCHAR(20) DEFAULT 'locked', approval_id INTEGER, created_by INTEGER NOT NULL, created_username VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, locked_at TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS archives (archive_id SERIAL PRIMARY KEY, repo_owner VARCHAR(100) NOT NULL, repo_name VARCHAR(100) NOT NULL, tag_name VARCHAR(100) NOT NULL, archive_type VARCHAR(50) DEFAULT 'archive', archive_reason TEXT, archive_file_name VARCHAR(255), archive_file_size BIGINT, storage_path VARCHAR(500), status VARCHAR(20) DEFAULT 'archived', archived_by INTEGER, approval_id VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (log_id VARCHAR(100) PRIMARY KEY, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, user_id INTEGER, username VARCHAR(100), nickname VARCHAR(100), department_id INTEGER, department_name VARCHAR(100), role_code VARCHAR(50), action_type VARCHAR(50) NOT NULL, action_name VARCHAR(100), target_type VARCHAR(50), target_id VARCHAR(100), target_name VARCHAR(255), request_method VARCHAR(10), request_path VARCHAR(500), request_body TEXT, request_ip VARCHAR(50), request_user_agent VARCHAR(500), response_status INTEGER, response_time_ms INTEGER, result VARCHAR(20), error_message TEXT, details TEXT, session_id VARCHAR(100), integrity_hash VARCHAR(64), prev_hash VARCHAR(64))`,
    `CREATE TABLE IF NOT EXISTS roles (role_id SERIAL PRIMARY KEY, role_code VARCHAR(50) UNIQUE NOT NULL, role_name VARCHAR(100) NOT NULL, description TEXT, permissions TEXT, is_system BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT TRUE, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS departments (dept_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL, parent_id INTEGER, sort_order INTEGER DEFAULT 0, leader VARCHAR(100), description TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS user_profiles (profile_id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL, gitea_username VARCHAR(100) NOT NULL, nickname VARCHAR(100), password_hash VARCHAR(255), department_id INTEGER, role_code VARCHAR(50) DEFAULT 'user', secret_level VARCHAR(20) DEFAULT 'internal', permissions TEXT, is_active BOOLEAN DEFAULT TRUE, account_locked BOOLEAN DEFAULT FALSE, last_login_ip VARCHAR(50), last_login_time TIMESTAMP, failed_login_attempts INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sessions (session_id VARCHAR(100) PRIMARY KEY, user_id INTEGER NOT NULL, username VARCHAR(100) NOT NULL, ip_address VARCHAR(50), user_agent VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS notifications (notification_id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, content TEXT, related_type VARCHAR(50), related_id VARCHAR(100), is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS risk_warnings (warning_id SERIAL PRIMARY KEY, level VARCHAR(20) NOT NULL, type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT, related_user_id INTEGER, related_username VARCHAR(100), source_ip VARCHAR(50), triggered_rule VARCHAR(100), triggered_value TEXT, rule_threshold TEXT, status VARCHAR(20) DEFAULT 'unhandled', handler_user_id INTEGER, handler_comment TEXT, handled_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS system_config (config_key VARCHAR(100) PRIMARY KEY, config_value TEXT, config_type VARCHAR(20) DEFAULT 'string', description TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS version_rules (id SERIAL PRIMARY KEY, default_pattern VARCHAR(100) DEFAULT 'MAJOR.MINOR.PATCH', patterns TEXT, auto_increment_rules TEXT, prohibit_patterns TEXT, enforce_on_tag_creation BOOLEAN DEFAULT TRUE, is_active BOOLEAN DEFAULT TRUE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS reports (report_id SERIAL PRIMARY KEY, template_id VARCHAR(100), name VARCHAR(255) NOT NULL, format VARCHAR(20) DEFAULT 'pdf', parameters TEXT, status VARCHAR(20) DEFAULT 'generating', file_path TEXT, file_size BIGINT, created_by INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS backups (backup_id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(20) DEFAULT 'manual', scope VARCHAR(20) DEFAULT 'full', status VARCHAR(20) DEFAULT 'running', progress INTEGER DEFAULT 0, file_size BIGINT, storage_path TEXT, checksum_sha256 VARCHAR(64), created_by VARCHAR(100), start_time TIMESTAMP, end_time TIMESTAMP)`,
  ];
  for (const sql of tables) { try { await database.raw(sql); } catch (err) { if (!err.message.includes('already exists')) console.warn('   警告:', err.message); } }
  // 2. 修复表结构+插入默认角色/部门（建表完成后再执行 ALTER TABLE / INSERT）
  await fixDatabaseSchema(database);
  console.log('✅ 数据库迁移完成');
}

/**
 * 插入默认种子数据
 */
export async function seedDefaultData() {
  const database = getDb();
  if (!database) return;
  console.log('📝 插入默认数据...');
  try {
    const roleCount = await database('roles').count('* as count').first();
    if (parseInt(roleCount.count) === 0) {
      await database('roles').insert([
        { role_code: 'admin', role_name: '系统管理员', description: '系统管理员，拥有所有权限', permissions: JSON.stringify(['*']), is_system: true, sort_order: 1 },
        { role_code: 'project_manager', role_name: '项目管理员', description: '项目管理员，负责仓库和版本管理', permissions: JSON.stringify(['repo:*', 'branch:*', 'version:*', 'approval:*', 'baseline:*']), is_system: true, sort_order: 2 },
        { role_code: 'developer', role_name: '开发人员', description: '开发人员，负责代码提交和分支操作', permissions: JSON.stringify(['repo:view', 'branch:create', 'version:view', 'approval:create']), is_system: true, sort_order: 3 },
        { role_code: 'auditor', role_name: '审计人员', description: '审计人员，负责查看审计日志', permissions: JSON.stringify(['audit:*', 'report:*']), is_system: true, sort_order: 4 },
      ]);
      console.log('   ✅ 默认角色已插入');
    }
    const deptCount = await database('departments').count('* as count').first();
    if (parseInt(deptCount.count) === 0) {
      await database('departments').insert([{ name: '技术部', code: 'TECH', sort_order: 1 }, { name: '运维部', code: 'OPS', sort_order: 2 }, { name: '安全部', code: 'SEC', sort_order: 3 }, { name: '综合部', code: 'ADMIN', sort_order: 4 }]);
      console.log('   ✅ 默认部门已插入');
    }
    const flowCount = await database('approval_flows').count('* as count').first();
    if (parseInt(flowCount.count) === 0) {
      await database('approval_flows').insert([{ name: '标准审批流程', description: '适用于普通操作的二级审批流程', applicable_operations: ['merge', 'version_create', 'baseline_create'], applicable_secret_levels: ['public', 'internal'], steps: ['技术负责人审核', '项目经理审批'], is_default: true, is_active: true }, { name: '涉密版本审批流程', description: '适用于涉密操作的四级审批流程', applicable_operations: ['merge', 'version_create', 'baseline_create', 'delete'], applicable_secret_levels: ['secret', 'top-secret'], steps: ['开发人员提交', '技术负责人审核', '安全管理员审核', '主管领导审批'], is_default: false, is_active: true }]);
      console.log('   ✅ 默认审批流程已插入');
    }
    console.log('📝 默认数据插入完成');
  } catch (error) { console.error('❌ 插入默认数据失败:', error.message); }
}