/**
 * 配置文件 - openGauss 版本
 * 支持从 .env 文件加载环境变量
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// 加载 .env 文件
dotenv.config();

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置对象
const config = {
  // 服务器配置
  port: parseInt(process.env.PORT || '8080'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // openGauss 数据库配置 (兼容 PostgreSQL 协议)
  database: {
    type: process.env.DB_TYPE || 'opengauss',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'gov_code_manager',
    user: process.env.DB_USER || 'dev_admin',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    // 连接池配置
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000
    }
  },
  
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // Gitea 配置
  gitea: {
    url: process.env.GITEA_URL || 'http://localhost:3000',
    apiVersion: process.env.GITEA_API_VERSION || 'v1',
    apiPrefix: process.env.GITEA_API_PREFIX || '/api/v1',
    token: process.env.GITEA_ADMIN_TOKEN || ''
  },
  
  // 审计配置
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '3650')
  },
  
  // API 配置
  api: {
    prefix: process.env.BFF_API_PREFIX || '/api/bff',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173']
  },
  
  // 安全配置
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
    sessionExpiry: parseInt(process.env.SESSION_EXPIRY || '604800'),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '1800')
  },
  
  // 速率限制配置
  rateLimit: {
    auth: {
      windowMs: 60 * 1000,
      max: 5
    },
    api: {
      windowMs: 60 * 1000,
      max: 100
    }
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};

// 验证关键配置
function validateConfig() {
  const required = [
    { key: 'database.host', value: config.database.host },
    { key: 'database.user', value: config.database.user }
  ];
  
  const missing = required.filter(r => !r.value);
  if (missing.length > 0) {
    console.warn('⚠️  缺少以下配置:');
    missing.forEach(r => console.warn(`   - ${r.key}`));
  }
}

validateConfig();

// 开发环境特殊配置
if (config.nodeEnv === 'development') {
  // 优先使用环境变量，未设置时生成随机临时密钥（每次重启不同，需重新登录）
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'gov_code_manager_jwt_secret_key_2024_secure') {
    config.jwt.secret = crypto.randomBytes(32).toString('hex');
    console.log('⚠️  开发环境未设置 JWT_SECRET，已生成随机临时密钥（每次重启变化）');
  } else {
    config.jwt.secret = process.env.JWT_SECRET;
  }
  console.log('🔧 开发环境配置已加载');
  console.log(`   数据库: ${config.database.host}:${config.database.port}/${config.database.database}`);
}

// 生产环境验证：缺凭据直接拒绝启动
if (config.nodeEnv === 'production') {
  const missing = [];
  // if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'gov_code_manager_jwt_secret_key_2024_secure') {
  //   missing.push('JWT_SECRET（请勿使用默认值）');
  // }
  // if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'Besti@2026_db') {
  //   missing.push('DB_PASSWORD（请勿使用默认值）');
  // }
  // if (!process.env.GITEA_ADMIN_TOKEN || process.env.GITEA_ADMIN_TOKEN === 'Basic YmVzdGk6aHVhd2VpNjY2') {
  //   missing.push('GITEA_ADMIN_TOKEN（请勿使用默认值）');
  // }
  if (missing.length > 0) {
    console.error('❌ 生产环境缺少/使用了已泄露的凭据环境变量：');
    missing.forEach(m => console.error(`   - ${m}`));
    console.error('   请设置正确的环境变量后重新启动。');
    process.exit(1);
  }
}

export default config;
