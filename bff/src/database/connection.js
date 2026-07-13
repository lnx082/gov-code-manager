/**
 * 数据库连接模块 - 支持 openGauss (兼容 PostgreSQL)
 */
import knex from 'knex';
import config from '../config/index.js';
import { createRequire } from 'module';

// 兼容 openGauss：修复 knex 无法解析 openGauss 版本字符串的问题
// openGauss version() 返回 "(openGauss 5.0.0 build ...)" 而非 "PostgreSQL ..."
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

// 创建数据库连接
let db = null;
let dbInitialized = false;

/**
 * 检查并修复数据库表结构
 */
async function fixDatabaseSchema(database) {
  console.log('🔍 检查数据库表结构...');

  // 按表检查缺失的列：每张表可能缺失的列清单
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
      { name: 'gitea_download_token', def: 'VARCHAR(255)' },
    ],
    roles: [
      { name: 'sort_order', def: 'INTEGER DEFAULT 0' },
      { name: 'is_system', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
      // 兼容两套列名（老版本用 code/name，新版本用 role_code/role_name）
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
  
  // 兼容两套列名：回填缺失的数据（老表有 code/name 但无 role_code/role_name，反之亦然）
  try {
    // role_code → code
    await database.raw("UPDATE roles SET code = role_code WHERE code IS NULL AND role_code IS NOT NULL");
    // code → role_code
    await database.raw("UPDATE roles SET role_code = code WHERE role_code IS NULL AND code IS NOT NULL");
    // role_name → name
    await database.raw("UPDATE roles SET name = role_name WHERE name IS NULL AND role_name IS NOT NULL");
    // name → role_name
    await database.raw("UPDATE roles SET role_name = name WHERE role_name IS NULL AND name IS NOT NULL");
  } catch (err) {
    console.warn(`  ⚠️  回填 roles 列数据失败: ${err.message}`);
  }

  // 确保 roles 表有数据
  try {
    const rolesCount = await database('roles').count('* as count').first();
    if (parseInt(rolesCount.count) === 0) {
      console.log('  📥 插入默认角色...');
      await database('roles').insert([
        { role_code: 'admin', role_name: '系统管理员', code: 'admin', name: '系统管理员', description: '系统管理员，拥有全部权限', permissions: '["*"]', is_system: true, sort_order: 1 },
        { role_code: 'project_manager', role_name: '项目管理员', code: 'project_manager', name: '项目管理员', description: '项目管理员，负责项目管理', permissions: '["repo:*", "branch:*", "version:*", "approval:*", "baseline:*"]', is_system: true, sort_order: 2 },
        { role_code: 'developer', role_name: '开发人员', code: 'developer', name: '开发人员', description: '开发人员，负责代码开发', permissions: '["repo:view", "repo:create", "branch:*", "version:view", "approval:create"]', is_system: true, sort_order: 3 },
        { role_code: 'auditor', role_name: '审计人员', code: 'auditor', name: '审计人员', description: '审计人员，负责审计监督', permissions: '["audit:*"]', is_system: true, sort_order: 4 },
      ]);
      console.log('  ✅ 默认角色插入成功');
    }
  } catch (err) {
    console.warn(`  ⚠️  插入默认角色失败: ${err.message}`);
  }

  // 确保 departments 表有数据
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
  
  // 迁移旧数据：secret_level 从 internal → secret
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

  // 仓库元数据表（仓库→部门→密级映射 + 中文显示名）
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
 */
export async function initDatabase() {
  if (dbInitialized && db) return db;

  console.log('📦 初始化 openGauss 数据库连接...');
  console.log(`   主机: ${config.database.host}`);
  console.log(`   端口: ${config.database.port}`);
  console.log(`   数据库: ${config.database.database}`);

  try {
    // openGauss 使用 PostgreSQL 协议
    db = knex({
      client: 'pg',
      connection: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        user: config.database.user,
        password: config.database.password,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        // 连接池配置
        pool: {
          min: 2,
          max: 20,
          acquireTimeoutMillis: 30000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
          createTimeoutMillis: 30000
        },
        // 连接超时配置
        connectionTimeoutMillis: 10000,
        // 空闲超时配置
        idleTimeoutMillis: 30000
      },
      // 兼容 openGauss 的设置
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000
      },
      // PostgreSQL 特定配置
      postgres: {
        // openGauss 支持 PostgreSQL 语法
        supportBigNumbers: true,
        bigNumberStrings: false,
        dateStrings: false,
        native: false
      }
    });

    // 测试连接
    console.log('🔄 正在连接数据库...');
    await db.raw('SELECT version()');
    console.log('✅ 数据库连接成功');
    
    dbInitialized = true;
    return db;
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('⚠️  将使用模拟数据模式运行');
    // ★ 必须赋值给全局 db，否则 getDb() 仍返回断连的 knox 实例导致 500
    db = createMockDb();
    dbInitialized = true;
    return db;
  }
}

/**
 * 获取数据库实例
 */
export function getDb() {
  if (!db) {
    // 延迟初始化
    initDatabase();
  }
  return db;
}

/**
 * 获取默认数据库实例（向后兼容）
 * 当作为 knex(tableName) 调用时，返回对应表的 query builder
 */
export default function getDefaultDb(tableName) {
  const instance = getDb();
  if (!instance) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  // 如果传了表名，返回 query builder；否则返回 knex 实例本身
  return tableName ? instance(tableName) : instance;
}

/**
 * 测试数据库连接
 */
export async function testConnection() {
  try {
    const database = getDb();
    if (!database) return false;
    
    const result = await database.raw('SELECT version()');
    console.log('✅ 数据库连接测试成功');
    console.log('   版本:', result.rows?.[0]?.version || 'openGauss/PostgreSQL');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接测试失败:', error.message);
    return false;
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase() {
  if (db) {
    await db.destroy();
    db = null;
    dbInitialized = false;
    console.log('📦 数据库连接已关闭');
  }
}

/**
 * 执行数据库迁移
 */
export async function runMigrations() {
  const database = getDb();
  if (!database) {
    console.warn('⚠️  数据库未连接，跳过迁移');
    return;
  }

  console.log('🔄 开始执行数据库迁移...');

  // 修复缺失的列和种子数据
  await fixDatabaseSchema(database);
  
  try {
    // 创建基础表
    const tables = [
      // 审批流程模板表
      `CREATE TABLE IF NOT EXISTS approval_flows (
        flow_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        applicable_operations TEXT[],
        applicable_secret_levels TEXT[],
        steps TEXT[],
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 审批申请主表
      `CREATE TABLE IF NOT EXISTS approvals (
        approval_id SERIAL PRIMARY KEY,
        operation_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        repo_owner VARCHAR(100),
        repo_name VARCHAR(100),
        source_branch VARCHAR(100),
        target_branch VARCHAR(100),
        gitea_pr_number INTEGER,
        secret_level VARCHAR(20) DEFAULT 'internal',
        urgency VARCHAR(20) DEFAULT 'normal',
        status VARCHAR(20) DEFAULT 'pending',
        current_step INTEGER DEFAULT 1,
        approval_flow_id INTEGER,
        applicant_user_id INTEGER NOT NULL,
        applicant_username VARCHAR(100) NOT NULL,
        reviewers TEXT,
        attachments TEXT,
        compliance_checklist TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )`,
      
      // 审批记录表
      `CREATE TABLE IF NOT EXISTS approval_records (
        record_id SERIAL PRIMARY KEY,
        approval_id INTEGER NOT NULL,
        step INTEGER NOT NULL,
        step_name VARCHAR(100),
        reviewer_user_id INTEGER,
        action VARCHAR(20) NOT NULL,
        comment TEXT,
        action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 基线表
      `CREATE TABLE IF NOT EXISTS baselines (
        baseline_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        version VARCHAR(50) NOT NULL,
        repo_owner VARCHAR(100) NOT NULL,
        repo_name VARCHAR(100) NOT NULL,
        tag_name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        lock_status VARCHAR(20) DEFAULT 'locked',
        approval_id INTEGER,
        created_by INTEGER NOT NULL,
        created_username VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        locked_at TIMESTAMP
      )`,
      
      // 归档表
      `CREATE TABLE IF NOT EXISTS archives (
        archive_id SERIAL PRIMARY KEY,
        repo_owner VARCHAR(100) NOT NULL,
        repo_name VARCHAR(100) NOT NULL,
        tag_name VARCHAR(100) NOT NULL,
        archive_type VARCHAR(50) DEFAULT 'archive',
        archive_reason TEXT,
        archive_file_name VARCHAR(255),
        archive_file_size BIGINT,
        storage_path VARCHAR(500),
        status VARCHAR(20) DEFAULT 'archived',
        archived_by INTEGER,
        approval_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 审计日志表（防篡改链）
      `CREATE TABLE IF NOT EXISTS audit_logs (
        log_id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        username VARCHAR(100),
        nickname VARCHAR(100),
        department_id INTEGER,
        department_name VARCHAR(100),
        role_code VARCHAR(50),
        action_type VARCHAR(50) NOT NULL,
        action_name VARCHAR(100),
        target_type VARCHAR(50),
        target_id VARCHAR(100),
        target_name VARCHAR(255),
        request_method VARCHAR(10),
        request_path VARCHAR(500),
        request_body TEXT,
        request_ip VARCHAR(50),
        request_user_agent VARCHAR(500),
        response_status INTEGER,
        response_time_ms INTEGER,
        result VARCHAR(20),
        error_message TEXT,
        details TEXT,
        session_id VARCHAR(100),
        integrity_hash VARCHAR(64),
        prev_hash VARCHAR(64)
      )`,
      
      // 角色表
      `CREATE TABLE IF NOT EXISTS roles (
        role_id SERIAL PRIMARY KEY,
        role_code VARCHAR(50) UNIQUE NOT NULL,
        role_name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 部门表
      `CREATE TABLE IF NOT EXISTS departments (
        dept_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        parent_id INTEGER,
        sort_order INTEGER DEFAULT 0,
        leader VARCHAR(100),
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 用户扩展表
      `CREATE TABLE IF NOT EXISTS user_profiles (
        profile_id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        gitea_username VARCHAR(100) NOT NULL,
        nickname VARCHAR(100),
        password_hash VARCHAR(255),
        department_id INTEGER,
        role_code VARCHAR(50) DEFAULT 'user',
        secret_level VARCHAR(20) DEFAULT 'internal',
        permissions TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        account_locked BOOLEAN DEFAULT FALSE,
        last_login_ip VARCHAR(50),
        last_login_time TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 会话表
      `CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(100) PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username VARCHAR(100) NOT NULL,
        ip_address VARCHAR(50),
        user_agent VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )`,
      
      // 通知表
      `CREATE TABLE IF NOT EXISTS notifications (
        notification_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        related_type VARCHAR(50),
        related_id VARCHAR(100),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 风险预警表
      `CREATE TABLE IF NOT EXISTS risk_warnings (
        warning_id SERIAL PRIMARY KEY,
        level VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        related_user_id INTEGER,
        related_username VARCHAR(100),
        source_ip VARCHAR(50),
        triggered_rule VARCHAR(100),
        triggered_value TEXT,
        rule_threshold TEXT,
        status VARCHAR(20) DEFAULT 'unhandled',
        handler_user_id INTEGER,
        handler_comment TEXT,
        handled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 系统配置表
      `CREATE TABLE IF NOT EXISTS system_config (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value TEXT,
        config_type VARCHAR(20) DEFAULT 'string',
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 版本规则表
      `CREATE TABLE IF NOT EXISTS version_rules (
        id SERIAL PRIMARY KEY,
        default_pattern VARCHAR(100) DEFAULT 'MAJOR.MINOR.PATCH',
        patterns TEXT,
        auto_increment_rules TEXT,
        prohibit_patterns TEXT,
        enforce_on_tag_creation BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      try {
        await database.raw(sql);
      } catch (err) {
        // 忽略已存在的表错误
        if (!err.message.includes('already exists')) {
          console.warn('   警告:', err.message);
        }
      }
    }
    
    console.log('✅ 数据库迁移完成');
    
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
  }
}

/**
 * 插入默认数据
 */
export async function seedDefaultData() {
  const database = getDb();
  if (!database) return;

  console.log('📝 插入默认数据...');

  try {
    // 检查是否已有数据
    const roleCount = await database('roles').count('* as count').first();
    
    if (parseInt(roleCount.count) === 0) {
      // 插入默认角色
      await database('roles').insert([
        { role_code: 'admin', role_name: '系统管理员', code: 'admin', name: '系统管理员', description: '系统管理员，拥有所有权限', permissions: JSON.stringify(['*']), is_system: true, sort_order: 1 },
        { role_code: 'project_manager', role_name: '项目管理员', code: 'project_manager', name: '项目管理员', description: '项目管理员，负责仓库和版本管理', permissions: JSON.stringify(['repo:*', 'branch:*', 'version:*', 'approval:*', 'baseline:*']), is_system: true, sort_order: 2 },
        { role_code: 'developer', role_name: '开发人员', code: 'developer', name: '开发人员', description: '开发人员，负责代码提交和分支操作', permissions: JSON.stringify(['repo:view', 'branch:create', 'version:view', 'approval:create']), is_system: true, sort_order: 3 },
        { role_code: 'auditor', role_name: '审计人员', code: 'auditor', name: '审计人员', description: '审计人员，负责查看审计日志', permissions: JSON.stringify(['audit:*', 'report:*']), is_system: true, sort_order: 4 },
      ]);
      console.log('   ✅ 默认角色已插入');
    }

    // 插入默认部门
    const deptCount = await database('departments').count('* as count').first();
    if (parseInt(deptCount.count) === 0) {
      await database('departments').insert([
        { name: '技术部', code: 'TECH', sort_order: 1 },
        { name: '运维部', code: 'OPS', sort_order: 2 },
        { name: '安全部', code: 'SEC', sort_order: 3 },
        { name: '综合部', code: 'ADMIN', sort_order: 4 }
      ]);
      console.log('   ✅ 默认部门已插入');
    }

    // 插入默认审批流程
    const flowCount = await database('approval_flows').count('* as count').first();
    if (parseInt(flowCount.count) === 0) {
      await database('approval_flows').insert([
        {
          name: '标准审批流程',
          description: '适用于普通操作的二级审批流程',
          applicable_operations: ['merge', 'version_create', 'baseline_create'],
          applicable_secret_levels: ['public', 'internal'],
          steps: ['技术负责人审核', '项目经理审批'],
          is_default: true,
          is_active: true
        },
        {
          name: '涉密版本审批流程',
          description: '适用于涉密操作的四级审批流程',
          applicable_operations: ['merge', 'version_create', 'baseline_create', 'delete'],
          applicable_secret_levels: ['secret', 'top-secret'],
          steps: ['开发人员提交', '技术负责人审核', '安全管理员审核', '主管领导审批'],
          is_default: false,
          is_active: true
        }
      ]);
      console.log('   ✅ 默认审批流程已插入');
    }

    console.log('📝 默认数据插入完成');
    
  } catch (error) {
    console.error('❌ 插入默认数据失败:', error.message);
  }
}

/**
 * 创建模拟数据库（用于开发/演示）
 * 必须同时支持：
 *   mockDb('table_name')        — 通过 default export 调用
 *   mockDb.table('table_name')  — 通过 knex 风格调用
 *   mockDb.raw(sql)             — 原生 SQL
 *   以及 .select/.where/.orderBy/.leftJoin/.limit/.offset/.first/.count 等链式方法
 */
function createMockDb() {
  console.log('⚠️  启用模拟数据库模式');

  const mockTables = {
    user_profiles: [
      { profile_id: 1, user_id: 1, gitea_username: 'admin', nickname: '管理员', role_code: 'admin', department_id: 1, secret_level: 'internal', is_active: true, account_locked: false, email: 'admin@gov.local', created_at: new Date(), updated_at: new Date() },
    ],
    roles: [
      { role_id: 1, role_code: 'admin', role_name: '系统管理员', permissions: JSON.stringify(['*']), is_system: true, sort_order: 1 },
      { role_id: 2, role_code: 'project_manager', role_name: '项目管理员', permissions: JSON.stringify(['repo:*', 'branch:*']), is_system: true, sort_order: 2 },
      { role_id: 3, role_code: 'developer', role_name: '开发人员', permissions: JSON.stringify(['repo:view', 'branch:create']), is_system: true, sort_order: 3 },
      { role_id: 4, role_code: 'auditor', role_name: '审计人员', permissions: JSON.stringify(['audit:*']), is_system: true, sort_order: 4 },
      { role_id: 5, role_code: 'user', role_name: '普通用户', permissions: JSON.stringify(['repo:view', 'version:view']), is_system: true, sort_order: 5 },
    ],
    departments: [
      { dept_id: 1, name: '技术部', code: 'TECH', sort_order: 1 },
      { dept_id: 2, name: '运维部', code: 'OPS', sort_order: 2 },
      { dept_id: 3, name: '安全部', code: 'SEC', sort_order: 3 },
      { dept_id: 4, name: '综合部', code: 'ADMIN', sort_order: 4 },
    ],
    approvals: [],
    audit_logs: [],
    baselines: [],
    archives: [],
    notifications: [],
    risk_warnings: [],
    version_rules: [],
    approval_flows: [],
    system_config: [],
  };

  // 创建一个可调用的函数对象：mockDb('table') 返回 QueryBuilder
  function getTableBuilder(tableName) {
    const data = mockTables[tableName] || [];
    const builder = {
      _data: [...data],
      _tableName: tableName,
      _whereConditions: [],
      _orderByCol: null,
      _orderByDir: 'asc',
      _limitVal: null,
      _offsetVal: null,
      _selectCols: [],
      _joins: [],   // [{ table, col1, col2, joinRows }]
      _countField: null,

      clone() {
        const b = Object.create(builder);
        b._data = [...this._data];
        b._whereConditions = [...this._whereConditions];
        b._orderByCol = this._orderByCol;
        b._orderByDir = this._orderByDir;
        b._limitVal = this._limitVal;
        b._offsetVal = this._offsetVal;
        b._selectCols = [...this._selectCols];
        b._joins = this._joins.map(j => ({ ...j, joinRows: [...j.joinRows] }));
        b._countField = this._countField;
        b._tableName = this._tableName;
        return b;
      },

      // 应用过滤条件
      applyFilters(dataArr) {
        let result = [...dataArr];
        for (const cond of this._whereConditions) {
          if (cond.raw) {
            // 简单支持 column = value
            result = result.filter(r => r[cond.col] == cond.val);
          } else if (cond.like) {
            const pattern = cond.val.replace(/%/g, '');
            result = result.filter(r => r[cond.col] && String(r[cond.col]).includes(pattern));
          }
        }
        return result;
      },

      // ======== 链式方法 ========

      select(...cols) {
        const b = this.clone();
        b._selectCols = cols.flat();
        return b;
      },

      where(col, val) {
        const b = this.clone();
        if (typeof col === 'object') {
          for (const [k, v] of Object.entries(col)) {
            b._whereConditions.push({ raw: true, col: k, val: v });
          }
        } else if (val === undefined) {
          // 只有第一个参数，类似 where({col: val}) 的单参数形式
          // 实际上这是 knex 的高级用法，这里简化处理
        } else {
          b._whereConditions.push({ raw: true, col, val });
        }
        return b;
      },

      whereIn(col, vals) {
        const b = this.clone();
        b._whereConditions.push({ raw: true, col, val: vals, op: 'in' });
        return b;
      },

      leftJoin(table, col1, col2) {
        const b = this.clone();
        const joinTable = mockTables[table] || [];
        b._joins.push({ table, col1, col2, joinRows: [...joinTable] });
        return b;
      },

      orderBy(col, dir = 'asc') {
        const b = this.clone();
        b._orderByCol = col;
        b._orderByDir = dir;
        return b;
      },

      limit(val) {
        const b = this.clone();
        b._limitVal = parseInt(val);
        return b;
      },

      offset(val) {
        const b = this.clone();
        b._offsetVal = parseInt(val);
        return b;
      },

      count(col = '*') {
        const b = this.clone();
        b._countField = col;
        // 返回一个同时支持 .first() 和 await 的 countBuilder
        const countBuilder = {
          ...b,
          first() {
            const filtered = countBuilder.applyFilters(mockTables[countBuilder._tableName] || []);
            const cnt = col === '*' ? filtered.length : filtered.filter(r => r[col] !== undefined && r[col] !== null).length;
            return makeThenable(() => ({ count: String(cnt) }), { count: '0' });
          },
          then(resolve, reject) {
            return countBuilder.first().then(resolve, reject);
          },
          catch(reject) {
            return countBuilder.first().catch(reject);
          },
        };
        return countBuilder;
      },

      first() {
        const b = this.clone();
        return makeThenable(() => {
          const filtered = b.applyFilters(mockTables[b._tableName] || []);
          const row = filtered.length > 0 ? { ...filtered[0] } : null;
          // 多个 LEFT JOIN 扩充
          if (row) {
            for (const join of b._joins) {
              const joinRow = join.joinRows.find(r => {
                const col1Val = this.resolveCol(join.col1, row);
                const col2Val = this.resolveCol(join.col2, r);
                return col1Val == col2Val;
              });
              if (joinRow) {
                for (const [k, v] of Object.entries(joinRow)) {
                  if (row[k] === undefined) row[k] = v;
                }
              }
            }
          }
          return row;
        }, null);
      },

      resolveCol(col, row) {
        if (col.includes('.')) {
          return row[col.split('.')[1]] || row[col];
        }
        return row[col];
      },

      insert(data) {
        const arr = Array.isArray(data) ? data : [data];
        for (const item of arr) {
          const table = mockTables[this._tableName] || [];
          const newId = table.length > 0 ? Math.max(...table.map(r => r[Object.keys(r)[0] || 'id'] || 0)) + 1 : 1;
          const newRow = { ...item };
          // 设置主键
          const pk = this._tableName === 'user_profiles' ? 'profile_id' :
                     this._tableName === 'roles' ? 'role_id' :
                     this._tableName === 'departments' ? 'dept_id' : 'id';
          newRow[pk] = newRow[pk] || newId;
          if (!newRow.created_at) newRow.created_at = new Date();
          if (!newRow.updated_at) newRow.updated_at = new Date();
          table.push(newRow);
        }
        return makeThenable(() => [newId || 1], [1]);
      },

      update(data) {
        const b = this.clone();
        return makeThenable(() => {
          const filtered = b.applyFilters(mockTables[b._tableName] || []);
          for (const row of filtered) {
            Object.assign(row, data);
            row.updated_at = new Date();
          }
          return filtered.length;
        }, 1);
      },

      delete() {
        const b = this.clone();
        return makeThenable(() => {
          const filtered = b.applyFilters(mockTables[b._tableName] || []);
          const table = mockTables[b._tableName];
          if (table) {
            for (const f of filtered) {
              const idx = table.indexOf(f);
              if (idx >= 0) table.splice(idx, 1);
            }
          }
          return filtered.length;
        }, 1);
      },

      // Promise 化：执行链式操作
      then(resolve, reject) {
        try {
          let result = this.applyFilters(mockTables[this._tableName] || []);

          // 多个 LEFT JOIN 扩充
          for (const join of this._joins) {
            result = result.map(row => {
              const r = { ...row };
              const joinRow = join.joinRows.find(jr => {
                const col1Val = this.resolveCol(join.col1, r);
                const col2Val = this.resolveCol(join.col2, jr);
                return col1Val == col2Val;
              });
              if (joinRow) {
                for (const [k, v] of Object.entries(joinRow)) {
                  if (r[k] === undefined) r[k] = v;
                }
              }
              return r;
            });
          }

          // ORDER BY
          if (this._orderByCol) {
            result.sort((a, b) => {
              const av = a[this._orderByCol] || '';
              const bv = b[this._orderByCol] || '';
              if (this._orderByDir === 'desc') return av > bv ? -1 : av < bv ? 1 : 0;
              return av > bv ? 1 : av < bv ? -1 : 0;
            });
          }

          // LIMIT / OFFSET
          if (this._offsetVal) result = result.slice(this._offsetVal);
          if (this._limitVal) result = result.slice(0, this._limitVal);

          resolve(result);
        } catch (e) {
          reject(e);
        }
      },

      // catch 支持
      catch(reject) {
        return this.then(null, reject);
      },
    };

    return builder;
  }

  // 辅助函数：创建一个 thenable 对象（用于 first/count/insert/update/delete）
  function makeThenable(fn, defaultVal) {
    return {
      then(resolve, reject) {
        if (!resolve) return this;
        try {
          resolve(fn());
        } catch (e) {
          if (reject) reject(e);
        }
      },
      catch(reject) {
        return this.then(null, reject);
      },
    };
  }

  // 核心 mock 函数：可调用，也可作为对象访问方法
  function mockDb(tableName) {
    const builder = getTableBuilder(tableName);
    return builder;
  }

  // mockDb.table('name') 兼容 knex 风格
  mockDb.table = function (tableName) {
    return getTableBuilder(tableName);
  };

  // raw SQL 支持
  mockDb.raw = function (sql) {
    return Promise.resolve({ rows: [{ '?column?': 1 }] });
  };

  // 顶层快捷方法（用于直接调用 mockDb.select(...) 等）
  mockDb.select = function (...cols) {
    const b = getTableBuilder('__virtual__');
    b._selectCols = cols.flat();
    return b;
  };
  mockDb.where = function (col, val) { return getTableBuilder('__virtual__').where(col, val); };
  mockDb.count = function (col) { return getTableBuilder('__virtual__').count(col); };
  mockDb.insert = function (data) { return getTableBuilder('__virtual__').insert(data); };
  mockDb.update = function (data) { return getTableBuilder('__virtual__').update(data); };
  mockDb.delete = function () { return getTableBuilder('__virtual__').delete(); };
  mockDb.destroy = function () { return Promise.resolve(); };
  mockDb.client = {};

  return mockDb;
}
