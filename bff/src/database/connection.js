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
}