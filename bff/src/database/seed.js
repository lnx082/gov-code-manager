// 初始化种子数据
import knex from 'knex';
import config from '../config/index.js';

const db = knex({
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
  },
});

async function seed() {
  console.log('开始填充初始数据...\n');

  try {
    // 检查是否已有数据
    const userCount = await db('user_profiles').count('* as count').first();
    if (parseInt(userCount.count) > 0) {
      console.log('数据已存在，跳过填充');
      return;
    }

    // 添加默认管理员用户
    await db('user_profiles').insert([
      {
        gitea_username: 'admin',
        nickname: '系统管理员',
        role_code: 'admin',
        department_id: 4, // 综合部
        secret_level: 'secret',
        is_active: true,
        created_at: new Date(),
      },
      {
        gitea_username: 'test',
        nickname: '测试用户',
        role_code: 'developer',
        department_id: 1, // 技术部
        secret_level: 'internal',
        is_active: true,
        created_at: new Date(),
      },
    ]);

    console.log('✅ 默认用户数据已填充');

    // 添加系统配置
    await db('system_config').insert([
      { config_key: 'system.version', config_value: '1.0.0', description: '系统版本' },
      { config_key: 'system.name', config_value: '党政软件版本管控平台', description: '系统名称' },
      { config_key: 'security.max_login_attempts', config_value: '5', description: '最大登录尝试次数' },
      { config_key: 'security.session_timeout', config_value: '3600', description: '会话超时时间(秒)' },
      { config_key: 'backup.auto_enabled', config_value: 'false', description: '是否启用自动备份' },
      { config_key: 'backup.retention_days', config_value: '30', description: '备份保留天数' },
    ]);

    console.log('✅ 系统配置数据已填充');

    console.log('\n🎉 数据填充完成！\n');

  } catch (error) {
    console.error('填充数据失败:', error);
  } finally {
    await db.destroy();
  }
}

seed();
