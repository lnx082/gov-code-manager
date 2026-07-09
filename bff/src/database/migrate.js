import knex from 'knex';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';

const db = knex({
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
  },
});

async function migrate() {
  console.log('🚀 开始数据库迁移...\n');

  try {
    // 1. 创建数据库（如果不存在）
    const dbName = config.database.database;
    
    try {
      await db.raw(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ 数据库 "${dbName}" 创建成功`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  数据库 "${dbName}" 已存在`);
      } else {
        // 可能是权限问题，尝试继续连接
        console.log(`ℹ️  数据库 "${dbName}" 可能已存在，继续...`);
      }
    }

    // 断开连接后重新连接到目标数据库
    await db.destroy();

    const targetDb = knex({
      client: 'pg',
      connection: {
        host: config.database.host,
        port: config.database.port,
        database: dbName,
        user: config.database.user,
        password: config.database.password,
      },
    });

    // 2. 创建表
    console.log('\n📦 创建数据表...\n');

    // 2.1 审批流程模板表
    await targetDb.schema.createTableIfNotExists('approval_flows', (table) => {
      table.increments('flow_id').primary();
      table.string('name', 100).notNullable().comment('流程名称');
      table.text('description').comment('流程描述');
      table.specificType('applicable_operations', 'TEXT[]').comment('适用的操作类型');
      table.specificType('applicable_secret_levels', 'TEXT[]').comment('适用的保密等级');
      table.specificType('steps', 'TEXT[]').comment('审批步骤 JSON');
      table.boolean('is_default').defaultTo(false).comment('是否为默认流程');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.integer('created_by').unsigned();
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ approval_flows (审批流程模板表)');

    // 2.2 审批申请主表
    await targetDb.schema.createTableIfNotExists('approvals', (table) => {
      table.increments('approval_id').primary();
      table.string('operation_type', 50).notNullable().comment('操作类型');
      table.string('title', 255).notNullable().comment('审批标题');
      table.text('description').comment('审批描述');
      table.string('repo_owner', 100).comment('仓库所有者');
      table.string('repo_name', 100).comment('仓库名称');
      table.string('source_branch', 100).comment('源分支');
      table.string('target_branch', 100).comment('目标分支');
      table.integer('gitea_pr_number').unsigned().comment('Gitea PR 编号');
      table.string('secret_level', 20).defaultTo('internal').comment('保密等级');
      table.string('urgency', 20).defaultTo('normal').comment('紧急程度');
      table.string('status', 20).defaultTo('pending').comment('状态');
      table.integer('current_step').unsigned().defaultTo(1).comment('当前步骤');
      table.integer('approval_flow_id').unsigned().comment('关联审批流程');
      table.integer('applicant_user_id').unsigned().notNullable().comment('申请人ID');
      table.string('applicant_username', 100).notNullable().comment('申请人用户名');
      table.text('reviewers').comment('审批人列表 JSON');
      table.text('attachments').comment('附件列表 JSON');
      table.text('compliance_checklist').comment('合规检查清单 JSON');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
      table.timestamp('completed_at').comment('完成时间');
    });
    console.log('✅ approvals (审批申请主表)');

    // 2.3 审批记录表
    await targetDb.schema.createTableIfNotExists('approval_records', (table) => {
      table.increments('record_id').primary();
      table.integer('approval_id').unsigned().notNullable().comment('关联审批ID');
      table.integer('step').unsigned().notNullable().comment('审批步骤');
      table.string('step_name', 100).comment('步骤名称');
      table.integer('reviewer_user_id').unsigned().comment('审批人ID');
      table.string('action', 20).notNullable().comment('操作');
      table.text('comment').comment('审批意见');
      table.timestamp('action_time').defaultTo(targetDb.fn.now());
    });
    console.log('✅ approval_records (审批记录表)');

    // 2.4 基线表
    await targetDb.schema.createTableIfNotExists('baselines', (table) => {
      table.increments('baseline_id').primary();
      table.string('name', 100).notNullable().comment('基线名称');
      table.string('version', 50).notNullable().comment('对应版本');
      table.string('repo_owner', 100).notNullable().comment('仓库所有者');
      table.string('repo_name', 100).notNullable().comment('仓库名称');
      table.string('tag_name', 100).notNullable().comment('Tag 名称');
      table.text('description').comment('基线描述');
      table.string('status', 20).defaultTo('active').comment('状态');
      table.string('lock_status', 20).defaultTo('locked').comment('锁定状态');
      table.integer('approval_id').unsigned().comment('关联审批ID');
      table.integer('created_by').unsigned().notNullable().comment('创建人');
      table.string('created_username', 100).notNullable().comment('创建人用户名');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
      table.timestamp('locked_at').comment('锁定时间');
    });
    console.log('✅ baselines (基线表)');

    // 2.5 归档表
    await targetDb.schema.createTableIfNotExists('archives', (table) => {
      table.increments('archive_id').primary();
      table.string('repo_owner', 100).notNullable().comment('仓库所有者');
      table.string('repo_name', 100).notNullable().comment('仓库名称');
      table.string('tag_name', 100).notNullable().comment('Tag 名称');
      table.string('archive_type', 50).defaultTo('archive').comment('归档类型');
      table.text('archive_reason').comment('归档原因');
      table.string('archive_file_name', 255).comment('归档文件名');
      table.bigInteger('archive_file_size').unsigned().comment('归档文件大小');
      table.string('storage_path', 500).comment('存储路径');
      table.string('status', 20).defaultTo('archived').comment('状态');
      table.integer('archived_by').unsigned().comment('归档人');
      table.string('approval_id', 100).comment('关联审批ID');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ archives (归档表)');

    // 2.6 版本废弃表
    await targetDb.schema.createTableIfNotExists('version_deprecations', (table) => {
      table.increments('deprecation_id').primary();
      table.string('repo_owner', 100).notNullable().comment('仓库所有者');
      table.string('repo_name', 100).notNullable().comment('仓库名称');
      table.string('tag_name', 100).notNullable().comment('Tag 名称');
      table.text('reason').comment('废弃原因');
      table.string('deprecation_type', 50).defaultTo('archive').comment('废弃类型');
      table.string('migration_version', 50).comment('迁移目标版本');
      table.string('status', 20).defaultTo('deprecated').comment('状态');
      table.string('approval_id', 100).comment('关联审批ID');
      table.integer('deprecated_by').unsigned().comment('操作人');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ version_deprecations (版本废弃表)');

    // 2.7 审计日志表（防篡改链）
    await targetDb.schema.createTableIfNotExists('audit_logs', (table) => {
      table.increments('log_id').primary();
      table.timestamp('timestamp').defaultTo(targetDb.fn.now());
      table.integer('user_id').unsigned().comment('用户ID');
      table.string('username', 100).comment('用户名');
      table.string('nickname', 100).comment('昵称');
      table.integer('department_id').unsigned().comment('部门ID');
      table.string('department_name', 100).comment('部门名称');
      table.string('role_code', 50).comment('角色代码');
      table.string('action_type', 50).notNullable().comment('操作类型');
      table.string('action_name', 100).comment('操作名称');
      table.string('target_type', 50).comment('目标类型');
      table.string('target_id', 100).comment('目标ID');
      table.string('target_name', 255).comment('目标名称');
      table.string('request_method', 10).comment('请求方法');
      table.string('request_path', 500).comment('请求路径');
      table.string('request_ip', 50).comment('请求IP');
      table.integer('response_status').unsigned().comment('响应状态');
      table.integer('response_time_ms').unsigned().comment('响应时间');
      table.string('result', 20).comment('结果');
      table.text('error_message').comment('错误信息');
      table.text('details').comment('详细信息 JSON');
      table.string('integrity_hash', 64).comment('完整性哈希');
      table.string('prev_hash', 64).comment('前一条记录哈希');
    });
    console.log('✅ audit_logs (审计日志表)');

    // 2.8 角色表
    await targetDb.schema.createTableIfNotExists('roles', (table) => {
      table.increments('role_id').primary();
      table.string('role_code', 50).unique().notNullable().comment('角色代码');
      table.string('role_name', 100).notNullable().comment('角色名称');
      table.text('description').comment('角色描述');
      table.text('permissions').comment('权限列表 JSON');
      table.boolean('is_system').defaultTo(false).comment('是否为系统角色');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.integer('sort_order').unsigned().defaultTo(0).comment('排序');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ roles (角色表)');

    // 2.9 部门表
    await targetDb.schema.createTableIfNotExists('departments', (table) => {
      table.increments('dept_id').primary();
      table.string('name', 100).notNullable().comment('部门名称');
      table.string('code', 50).unique().notNullable().comment('部门代码');
      table.integer('parent_id').unsigned().comment('父部门ID');
      table.integer('sort_order').unsigned().defaultTo(0).comment('排序');
      table.string('leader', 100).comment('部门负责人');
      table.text('description').comment('部门描述');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ departments (部门表)');

    // 2.10 用户扩展表（增加 password_hash 字段）
    await targetDb.schema.createTableIfNotExists('user_profiles', (table) => {
      table.increments('profile_id').primary();
      table.integer('user_id').unsigned().unique().notNullable().comment('用户ID');
      table.string('gitea_username', 100).notNullable().comment('Gitea 用户名');
      table.string('nickname', 100).comment('昵称');
      table.string('password_hash', 255).comment('本地密码哈希');
      table.integer('department_id').unsigned().comment('部门ID');
      table.string('role_code', 50).defaultTo('user').comment('角色代码');
      table.string('secret_level', 20).defaultTo('internal').comment('用户保密等级');
      table.text('permissions').comment('扩展权限 JSON');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.boolean('account_locked').defaultTo(false).comment('账户是否锁定');
      table.string('last_login_ip', 50).comment('最后登录IP');
      table.timestamp('last_login_time').comment('最后登录时间');
      table.integer('failed_login_attempts').unsigned().defaultTo(0).comment('连续登录失败次数');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ user_profiles (用户扩展表)');

    // 2.11 会话表
    await targetDb.schema.createTableIfNotExists('sessions', (table) => {
      table.string('session_id', 100).primary().comment('会话ID');
      table.integer('user_id').unsigned().notNullable().comment('用户ID');
      table.string('username', 100).notNullable().comment('用户名');
      table.string('ip_address', 50).comment('IP地址');
      table.string('user_agent', 500).comment('用户代理');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
      table.timestamp('last_active_at').defaultTo(targetDb.fn.now());
      table.timestamp('expires_at').notNullable().comment('过期时间');
    });
    console.log('✅ sessions (会话表)');

    // 2.12 通知表
    await targetDb.schema.createTableIfNotExists('notifications', (table) => {
      table.increments('notification_id').primary();
      table.integer('user_id').unsigned().notNullable().comment('用户ID');
      table.string('type', 50).notNullable().comment('通知类型');
      table.string('title', 255).notNullable().comment('通知标题');
      table.text('content').comment('通知内容');
      table.string('related_type', 50).comment('关联类型');
      table.string('related_id', 100).comment('关联ID');
      table.boolean('is_read').defaultTo(false).comment('是否已读');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ notifications (通知表)');

    // 2.13 风险预警表
    await targetDb.schema.createTableIfNotExists('risk_warnings', (table) => {
      table.increments('warning_id').primary();
      table.string('level', 20).notNullable().comment('预警级别');
      table.string('type', 50).notNullable().comment('预警类型');
      table.string('title', 255).notNullable().comment('预警标题');
      table.text('description').comment('预警描述');
      table.integer('related_user_id').unsigned().comment('关联用户ID');
      table.string('related_username', 100).comment('关联用户名');
      table.string('source_ip', 50).comment('来源IP');
      table.string('triggered_rule', 100).comment('触发规则');
      table.text('triggered_value').comment('触发值');
      table.text('rule_threshold').comment('规则阈值');
      table.string('status', 20).defaultTo('unhandled').comment('状态');
      table.integer('handler_user_id').unsigned().comment('处理人ID');
      table.text('handler_comment').comment('处理意见');
      table.timestamp('handled_at').comment('处理时间');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ risk_warnings (风险预警表)');

    // 2.14 报表记录表
    await targetDb.schema.createTableIfNotExists('reports', (table) => {
      table.increments('report_id').primary();
      table.string('template_id', 100).comment('报表模板ID');
      table.string('name', 255).notNullable().comment('报表名称');
      table.string('format', 20).defaultTo('pdf').comment('导出格式');
      table.text('parameters').comment('报表参数 JSON');
      table.string('status', 20).defaultTo('generating').comment('状态');
      table.text('file_path').comment('文件路径');
      table.bigInteger('file_size').unsigned().comment('文件大小');
      table.integer('created_by').unsigned().comment('创建人');
      table.timestamp('created_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ reports (报表记录表)');

    // 2.15 备份记录表
    await targetDb.schema.createTableIfNotExists('backups', (table) => {
      table.increments('backup_id').primary();
      table.string('name', 255).notNullable().comment('备份名称');
      table.string('type', 20).defaultTo('manual').comment('备份类型');
      table.string('scope', 20).defaultTo('full').comment('备份范围');
      table.string('status', 20).defaultTo('running').comment('状态');
      table.integer('progress').unsigned().defaultTo(0).comment('进度');
      table.bigInteger('file_size').unsigned().comment('文件大小');
      table.text('storage_path').comment('存储路径');
      table.string('checksum_sha256', 64).comment('校验和');
      table.string('created_by', 100).comment('创建人');
      table.timestamp('start_time').comment('开始时间');
      table.timestamp('end_time').comment('结束时间');
    });
    console.log('✅ backups (备份记录表)');

    // 2.16 系统配置表
    await targetDb.schema.createTableIfNotExists('system_config', (table) => {
      table.string('config_key', 100).primary().comment('配置键');
      table.text('config_value').comment('配置值');
      table.string('config_type', 20).defaultTo('string').comment('配置类型');
      table.text('description').comment('配置描述');
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ system_config (系统配置表)');

    // 2.17 版本规则表
    await targetDb.schema.createTableIfNotExists('version_rules', (table) => {
      table.increments('id').primary();
      table.string('default_pattern', 100).defaultTo('MAJOR.MINOR.PATCH').comment('默认模式');
      table.text('patterns').comment('模式配置 JSON');
      table.text('auto_increment_rules').comment('自动递增规则 JSON');
      table.text('prohibit_patterns').comment('禁止模式 JSON');
      table.boolean('enforce_on_tag_creation').defaultTo(true).comment('创建 Tag 时强制执行');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.timestamp('updated_at').defaultTo(targetDb.fn.now());
    });
    console.log('✅ version_rules (版本规则表)');

    console.log('\n✅ 所有数据表创建完成！\n');

    // 3. 插入默认数据
    console.log('📝 插入默认数据...\n');
    await insertDefaultData(targetDb);

    await targetDb.destroy();
    console.log('🎉 数据库迁移完成！\n');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

async function insertDefaultData(db) {
  // 插入默认角色
  const existingRoles = await db('roles').count('* as count').first();
  if (parseInt(existingRoles.count) === 0) {
    await db('roles').insert([
      { role_code: 'admin', role_name: '系统管理员', description: '系统管理员，拥有所有权限', permissions: JSON.stringify(['*']), is_system: true, sort_order: 1 },
      { role_code: 'project_manager', role_name: '项目管理员', description: '项目管理员，负责仓库和版本管理', permissions: JSON.stringify(['repo:*', 'branch:*', 'version:*', 'approval:*', 'baseline:*']), is_system: true, sort_order: 2 },
      { role_code: 'developer', role_name: '开发人员', description: '开发人员，负责代码提交和分支操作', permissions: JSON.stringify(['repo:view', 'branch:create', 'version:view', 'approval:create']), is_system: true, sort_order: 3 },
      { role_code: 'auditor', role_name: '审计人员', description: '审计人员，负责查看审计日志', permissions: JSON.stringify(['audit:*', 'report:*']), is_system: true, sort_order: 4 },
      { role_code: 'user', role_name: '普通用户', description: '普通用户，仅有查看权限', permissions: JSON.stringify(['repo:view', 'branch:view', 'version:view']), is_system: true, sort_order: 5 },
    ]);
    console.log('✅ 默认角色数据已插入');
  }

  // 插入默认部门
  const existingDepts = await db('departments').count('* as count').first();
  if (parseInt(existingDepts.count) === 0) {
    await db('departments').insert([
      { name: '技术部', code: 'TECH', sort_order: 1 },
      { name: '运维部', code: 'OPS', sort_order: 2 },
      { name: '安全部', code: 'SEC', sort_order: 3 },
      { name: '综合部', code: 'ADMIN', sort_order: 4 },
    ]);
    console.log('✅ 默认部门数据已插入');
  }

  // 插入默认审批流程
  const existingFlows = await db('approval_flows').count('* as count').first();
  if (parseInt(existingFlows.count) === 0) {
    await db('approval_flows').insert([
      {
        name: '标准审批流程',
        description: '适用于普通操作的二级审批流程',
        applicable_operations: ['merge', 'version_create', 'baseline_create'],
        applicable_secret_levels: ['public', 'internal'],
        steps: ['技术负责人审核', '项目经理审批'],
        is_default: true,
        is_active: true,
      },
      {
        name: '涉密版本审批流程',
        description: '适用于涉密操作的四级审批流程',
        applicable_operations: ['merge', 'version_create', 'baseline_create', 'delete'],
        applicable_secret_levels: ['secret', 'top-secret'],
        steps: ['开发人员提交', '技术负责人审核', '安全管理员审核', '主管领导审批'],
        is_default: false,
        is_active: true,
      },
    ]);
    console.log('✅ 默认审批流程数据已插入');
  }

  // 插入默认版本规则
  const existingRules = await db('version_rules').count('* as count').first();
  if (parseInt(existingRules.count) === 0) {
    await db('version_rules').insert([{
      default_pattern: 'MAJOR.MINOR.PATCH',
      patterns: JSON.stringify([
        { pattern: 'MAJOR.MINOR.PATCH', example: '1.2.3', description: '标准语义化版本' },
        { pattern: 'MAJOR.MINOR.PATCH-PRE', example: '1.0.0-beta.1', description: '预发布版本' },
      ]),
      auto_increment_rules: JSON.stringify({
        'commit': 'patch',
        'feature': 'minor',
        'breaking': 'major',
      }),
      prohibit_patterns: JSON.stringify([
        { pattern: 'v0.0.0', reason: '不能使用 0.0.0 版本' },
        { pattern: '*-SNAPSHOT', reason: '不允许 SNAPSHOT 后缀' },
      ]),
      enforce_on_tag_creation: true,
      is_active: true,
    }]);
    console.log('✅ 默认版本规则已插入');
  }

  // 插入默认测试用户（使用 Gitea 用户名和密码）
  const existingUsers = await db('user_profiles').count('* as count').first();
  if (parseInt(existingUsers.count) === 0) {
    // 使用 bcrypt 加密默认密码 "admin123"
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await db('user_profiles').insert([
      {
        gitea_username: 'root',
        nickname: '系统管理员',
        password_hash: hashedPassword,
        role_code: 'admin',
        department_id: 4,
        secret_level: 'secret',
        is_active: true,
        created_at: new Date(),
      },
      {
        gitea_username: 'git',
        nickname: 'Git用户',
        password_hash: hashedPassword,
        role_code: 'developer',
        department_id: 1,
        secret_level: 'internal',
        is_active: true,
        created_at: new Date(),
      },
    ]);
    console.log('✅ 默认测试用户已插入（root/admin123, git/admin123）');
  }

  console.log('📝 默认数据插入完成！\n');
}

migrate();
