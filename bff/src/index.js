/**
 * 党政软件版本管控平台 BFF 层 - openGauss 版本
 * Backend For Frontend - 中间层服务
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { initDatabase, testConnection, runMigrations, seedDefaultData, closeDatabase } from './database/connection.js';
import { auditMiddleware } from './middleware/audit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// 导入路由
import authRoutes from './routes/auth.js';
import repoRoutes from './routes/repos.js';
import approvalRoutes from './routes/approvals.js';
import versionRoutes from './routes/versions.js';
import auditRoutes from './routes/audit.js';

// 创建 Express 应用
const app = express();

// 基础中间件
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: config.api.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(config.logging.format));

// 请求日志
app.use(requestLogger);

// 健康检查
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    const db = await import('./database/connection.js');
    const connected = await db.testConnection();
    dbStatus = connected ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'error';
  }
  
  res.json({
    status: 'ok',
    service: 'gov-code-manager-bff',
    version: '1.0.0',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// API 路由
const API_PREFIX = config.api.prefix;

// 认证路由
app.use(`${API_PREFIX}/auth`, authRoutes);

// 仓库路由
app.use(`${API_PREFIX}/repos`, repoRoutes);

// 审批路由
app.use(`${API_PREFIX}/approvals`, approvalRoutes);

// 版本路由
app.use(`${API_PREFIX}/versions`, versionRoutes);

// 审计路由
app.use(`${API_PREFIX}/audit`, auditRoutes);

// 审计中间件
app.use(auditMiddleware);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: `请求路径 ${req.path} 不存在`
  });
});

// 错误处理
app.use(errorHandler);

// 启动服务器
async function startServer() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║     党政软件版本管控平台 BFF 层                           ║');
  console.log('║     GovCode Version Control Platform                     ║');
  console.log('║     Database: openGauss @ 123.60.219.19                  ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // 初始化数据库
  console.log('📦 初始化数据库连接...');
  await initDatabase();
  
  // 测试连接
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn('⚠️  数据库连接失败，将使用模拟数据运行');
  } else {
    // 执行数据库迁移
    await runMigrations();
    
    // 插入默认数据
    await seedDefaultData();
  }
  
  // 启动服务
  app.listen(config.port, '0.0.0.0', () => {
    console.log('');
    console.log('✅ 服务器启动成功！');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`🌐 服务地址: http://0.0.0.0:${config.port}`);
    console.log(`🔗 API 前缀: ${API_PREFIX}`);
    console.log(`📊 健康检查: http://0.0.0.0:${config.port}/health`);
    console.log(`🔧 环境: ${config.nodeEnv}`);
    console.log(`🗄️  数据库: openGauss @ ${config.database.host}:${config.database.port}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log('');
    console.log('可用接口:');
    console.log(`  POST ${API_PREFIX}/auth/login     - 用户登录`);
    console.log(`  GET  ${API_PREFIX}/auth/me        - 获取当前用户`);
    console.log(`  GET  ${API_PREFIX}/repos          - 获取仓库列表`);
    console.log(`  GET  ${API_PREFIX}/approvals      - 获取审批列表`);
    console.log(`  GET  ${API_PREFIX}/versions       - 获取版本列表`);
    console.log(`  GET  ${API_PREFIX}/audit/logs     - 获取审计日志');
    console.log('');
    console.log('默认账号:');
    console.log('  用户名: root');
    console.log('  密码: admin123');
    console.log('');
  });
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('📤 收到 SIGTERM 信号，正在关闭服务器...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n📤 收到 SIGINT 信号，正在关闭服务器...');
  await closeDatabase();
  process.exit(0);
});

// 启动
startServer().catch(error => {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
});
