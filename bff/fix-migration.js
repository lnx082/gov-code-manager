/**
 * 数据库修复迁移脚本
 * 用于添加缺失的列到已存在的表中
 * 
 * 使用方法: node fix-migration.js
 */

import knex from 'knex';
import config from './src/config/index.js';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  client: 'pg',
  connection: {
    host: config.database?.host || process.env.DB_HOST || '192.168.1.6',
    port: config.database?.port || process.env.DB_PORT || 5432,
    database: config.database?.database || process.env.DB_NAME || 'gitea',
    user: config.database?.user || process.env.DB_USER || 'git',
    password: config.database?.password || process.env.DB_PASSWORD || 'git',
  },
  pool: { min: 1, max: 5 }
};

const db = knex(dbConfig);

async function columnExists(tableName, columnName) {
  try {
    const result = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' AND column_name = '${columnName}'
    `);
    return result.rows.length > 0;
  } catch (e) {
    return false;
  }
}

async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  const exists = await columnExists(tableName, columnName);
  if (!exists) {
    console.log(`  ➕ 添加列: ${tableName}.${columnName}`);
    try {
      await db.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`  ✅ ${tableName}.${columnName} 添加成功`);
    } catch (err) {
      console.log(`  ⚠️  ${tableName}.${columnName} 添加失败: ${err.message}`);
    }
  } else {
    console.log(`  ✓ ${tableName}.${columnName} 已存在`);
  }
}

async function runMigrations() {
  console.log('\n🔧 开始数据库修复迁移...\n');
  console.log(`📦 连接到数据库: ${dbConfig.connection.host}:${dbConfig.connection.port}/${dbConfig.connection.database}`);
  
  try {
    // 测试连接
    await db.raw('SELECT 1');
    console.log('✅ 数据库连接成功\n');

    // ====== 修复 user_profiles 表 ======
    console.log('📋 修复 user_profiles 表...');
    
    await addColumnIfNotExists('user_profiles', 'account_locked', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('user_profiles', 'failed_login_attempts', 'INTEGER DEFAULT 0');
    await addColumnIfNotExists('user_profiles', 'last_login_ip', 'VARCHAR(50)');
    await addColumnIfNotExists('user_profiles', 'last_login_time', 'TIMESTAMP');
    await addColumnIfNotExists('user_profiles', 'locked_until', 'TIMESTAMP');
    await addColumnIfNotExists('user_profiles', 'email', 'VARCHAR(255)');
    
    // ====== 检查并初始化 roles 表 ======
    console.log('\n📋 检查 roles 表...');
    
    const rolesTableExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'roles'
      )
    `);
    
    if (!rolesTableExists.rows[0].exists) {
      console.log('  ➕ 创建 roles 表...');
      await db.raw(`
        CREATE TABLE roles (
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
        )
      `);
      console.log('  ✅ roles 表创建成功');
      
      // 插入默认角色
      console.log('  📥 插入默认角色...');
      await db.raw(`
        INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order) VALUES
        ('admin', '系统管理员', '系统管理员，拥有全部权限', '["*"]', true, 1),
        ('project_manager', '项目管理员', '项目管理员，负责项目管理', '["repo:*", "branch:*", "version:*", "approval:*", "baseline:*"]', true, 2),
        ('developer', '开发人员', '开发人员，负责代码开发', '["repo:view", "repo:create", "branch:*", "version:view", "approval:create"]', true, 3),
        ('auditor', '审计人员', '审计人员，负责审计监督', '["audit:*"]', true, 4),
        ('user', '普通用户', '普通用户，基础权限', '["repo:view", "version:view"]', true, 5)
        ON CONFLICT (role_code) DO NOTHING
      `);
      console.log('  ✅ 默认角色插入成功');
    } else {
      console.log('  ✓ roles 表已存在');
      
      // 确保有默认角色
      const rolesCount = await db('roles').count('* as count').first();
      if (parseInt(rolesCount.count) === 0) {
        console.log('  ⚠️  roles 表为空，插入默认角色...');
        await db.raw(`
          INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order) VALUES
          ('admin', '系统管理员', '系统管理员，拥有全部权限', '["*"]', true, 1),
          ('project_manager', '项目管理员', '项目管理员，负责项目管理', '["repo:*", "branch:*", "version:*", "approval:*", "baseline:*"]', true, 2),
          ('developer', '开发人员', '开发人员，负责代码开发', '["repo:view", "repo:create", "branch:*", "version:view", "approval:create"]', true, 3),
          ('auditor', '审计人员', '审计人员，负责审计监督', '["audit:*"]', true, 4),
          ('user', '普通用户', '普通用户，基础权限', '["repo:view", "version:view"]', true, 5)
        `);
        console.log('  ✅ 默认角色插入成功');
      }
    }

    // ====== 检查并初始化 departments 表 ======
    console.log('\n📋 检查 departments 表...');
    
    const deptsTableExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'departments'
      )
    `);
    
    if (!deptsTableExists.rows[0].exists) {
      console.log('  ➕ 创建 departments 表...');
      await db.raw(`
        CREATE TABLE departments (
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
        )
      `);
      console.log('  ✅ departments 表创建成功');
      
      // 插入默认部门
      console.log('  📥 插入默认部门...');
      await db.raw(`
        INSERT INTO departments (name, code, description) VALUES
        ('技术部', 'tech', '技术研发部门'),
        ('运维部', 'ops', '运维保障部门'),
        ('安全部', 'security', '安全审计部门'),
        ('综合部', 'admin', '综合管理部门')
        ON CONFLICT (code) DO NOTHING
      `);
      console.log('  ✅ 默认部门插入成功');
    } else {
      console.log('  ✓ departments 表已存在');
    }

    console.log('\n✅ 数据库修复迁移完成!\n');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

runMigrations();
