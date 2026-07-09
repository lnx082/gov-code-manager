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
    return createMockDb();
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
 */
export default function getDefaultDb() {
  return getDb();
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
        { role_code: 'admin', role_name: '系统管理员', description: '系统管理员，拥有所有权限', permissions: JSON.stringify(['*']), is_system: true, sort_order: 1 },
        { role_code: 'project_manager', role_name: '项目管理员', description: '项目管理员，负责仓库和版本管理', permissions: JSON.stringify(['repo:*', 'branch:*', 'version:*', 'approval:*', 'baseline:*']), is_system: true, sort_order: 2 },
        { role_code: 'developer', role_name: '开发人员', description: '开发人员，负责代码提交和分支操作', permissions: JSON.stringify(['repo:view', 'branch:create', 'version:view', 'approval:create']), is_system: true, sort_order: 3 },
        { role_code: 'auditor', role_name: '审计人员', description: '审计人员，负责查看审计日志', permissions: JSON.stringify(['audit:*', 'report:*']), is_system: true, sort_order: 4 },
        { role_code: 'user', role_name: '普通用户', description: '普通用户，仅有查看权限', permissions: JSON.stringify(['repo:view', 'branch:view', 'version:view']), is_system: true, sort_order: 5 }
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
 */
function createMockDb() {
  console.log('⚠️  启用模拟数据库模式');
  
  const mockData = {
    users: [],
    roles: [
      { role_id: 1, role_code: 'admin', role_name: '系统管理员', permissions: JSON.stringify(['*']) },
      { role_id: 2, role_code: 'project_manager', role_name: '项目管理员', permissions: JSON.stringify(['repo:*', 'branch:*']) },
      { role_id: 3, role_code: 'developer', role_name: '开发人员', permissions: JSON.stringify(['repo:view', 'branch:create']) }
    ],
    departments: [
      { dept_id: 1, name: '技术部', code: 'TECH' },
      { dept_id: 2, name: '运维部', code: 'OPS' },
      { dept_id: 3, name: '安全部', code: 'SEC' }
    ],
    approvals: [],
    audit_logs: []
  };

  return {
    select: () => ({
      where: (conditions) => ({
        first: () => mockData.approvals?.[0] || null,
        orderBy: () => ({
          limit: () => ({
            offset: () => ({
              then: (resolve) => resolve({ list: [], total: 0 })
            })
          })
        }),
        then: (resolve) => resolve({ list: [], total: 0 })
      }),
      then: (resolve) => resolve({ list: [], total: 0 })
    }),
    where: (table) => ({
      where: (conditions) => ({
        first: () => mockData[table]?.[0] || null,
        orderBy: () => ({
          limit: () => ({
            offset: () => ({
              then: (resolve) => resolve({ list: [], total: 0 })
            })
          })
        }),
        then: (resolve) => resolve(mockData[table] || [])
      }),
      first: () => mockData[table]?.[0] || null,
      insert: (data) => Promise.resolve([1]),
      update: (data) => Promise.resolve(1),
      delete: () => Promise.resolve(1),
      then: (resolve) => resolve(mockData[table] || [])
    }),
    count: (field) => ({
      first: () => ({ count: '0' }),
      then: (resolve) => resolve({ count: '0' })
    }),
    insert: (data) => Promise.resolve([1]),
    update: (data) => Promise.resolve(1),
    delete: () => Promise.resolve(1),
    raw: (sql) => Promise.resolve({ rows: [{ '?column?': 1 }] }),
    destroy: () => Promise.resolve()
  };
}
