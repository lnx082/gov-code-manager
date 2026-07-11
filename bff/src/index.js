/**
 * 党政软件版本管控平台 BFF 层 - openGauss 版本
 * Backend For Frontend - 中间层服务
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/index.js';
import { initDatabase, testConnection, runMigrations, seedDefaultData, closeDatabase } from './database/connection.js';
import { auditMiddleware } from './middleware/audit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// 导入路由
import authRoutes from './routes/auth.js';
import repoRoutes from './routes/repos.js';
import repoMetaRoutes from './routes/repoMeta.js';
import approvalRoutes from './routes/approvals.js';
import approvalFlowRoutes from './routes/approvalFlows.js';
import versionRoutes from './routes/versions.js';
import versionRuleRoutes from './routes/versionRules.js';
import deprecationRoutes from './routes/deprecations.js';
import auditRoutes from './routes/audit.js';
import roleRoutes from './routes/roles.js';
import permissionRoutes from './routes/permissions.js';
import departmentRoutes from './routes/departments.js';
import userRoutes from './routes/users.js';
import sessionRoutes from './routes/sessions.js';
import notificationRoutes from './routes/notifications.js';
import backupRoutes from './routes/backups.js';
import reportRoutes from './routes/reports.js';
import statisticsRoutes from './routes/statistics.js';
import systemRoutes from './routes/system.js';
import riskWarningRoutes from './routes/riskWarnings.js';
import complianceRoutes from './routes/compliance.js';
import integrityRoutes from './routes/integrity.js';
import baselineRoutes from './routes/baselines.js';
import archiveRoutes from './routes/archives.js';
import branchRoutes from './routes/branches.js';
import giteaRoutes from './routes/gitea.js';

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

// 审计中间件（必须在所有业务路由之前注册，才能拦截 res.send）
app.use(auditMiddleware);

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

// 仓库元数据路由（部门密级映射 + 中文名）
app.use(`${API_PREFIX}/repo-meta`, repoMetaRoutes);

// 分支路由（Gitea 代理）
app.use(`${API_PREFIX}/branches`, branchRoutes);

// 审批路由
app.use(`${API_PREFIX}/approvals`, approvalRoutes);

// 审批流程模板路由
app.use(`${API_PREFIX}/approval-flows`, approvalFlowRoutes);

// 版本路由
app.use(`${API_PREFIX}/versions`, versionRoutes);

// 版本编号规则路由
app.use(`${API_PREFIX}/version-rules`, versionRuleRoutes);

// 版本废弃路由
app.use(`${API_PREFIX}/version-deprecations`, deprecationRoutes);

// 基线路由
app.use(`${API_PREFIX}/baselines`, baselineRoutes);

// 归档路由
app.use(`${API_PREFIX}/archives`, archiveRoutes);

// 审计路由
app.use(`${API_PREFIX}/audit`, auditRoutes);

// 角色路由
app.use(`${API_PREFIX}/roles`, roleRoutes);

// 权限路由
app.use(`${API_PREFIX}/permissions`, permissionRoutes);

// 部门路由
app.use(`${API_PREFIX}/departments`, departmentRoutes);

// 用户管理路由
app.use(`${API_PREFIX}/users`, userRoutes);

// 会话管理路由
app.use(`${API_PREFIX}/sessions`, sessionRoutes);

// 通知路由
app.use(`${API_PREFIX}/notifications`, notificationRoutes);

// 备份路由
app.use(`${API_PREFIX}/backups`, backupRoutes);

// 报表路由
app.use(`${API_PREFIX}/reports`, reportRoutes);

// 统计看板路由
app.use(`${API_PREFIX}/statistics`, statisticsRoutes);

// 系统配置路由
app.use(`${API_PREFIX}/system`, systemRoutes);

// 风险预警路由
app.use(`${API_PREFIX}/risk-warnings`, riskWarningRoutes);

// 合规检查路由
app.use(`${API_PREFIX}/compliance`, complianceRoutes);

// 完整性校验路由
app.use(`${API_PREFIX}/integrity`, integrityRoutes);

// Gitea 透传代理（必须最后挂载，避免拦截其他路由）
app.use(`${API_PREFIX}/gitea`, giteaRoutes);

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
    console.log('已挂载路由模块 (25个):');
    console.log(`  POST ${API_PREFIX}/auth/login             - 用户登录`);
    console.log(`  GET  ${API_PREFIX}/auth/me                - 获取当前用户`);
    console.log(`  GET  ${API_PREFIX}/repos                  - 仓库管理`);
    console.log(`  GET  ${API_PREFIX}/branches               - 分支管理`);
    console.log(`  GET  ${API_PREFIX}/approvals              - 审批管理`);
    console.log(`  GET  ${API_PREFIX}/approval-flows         - 审批流程模板`);
    console.log(`  GET  ${API_PREFIX}/versions               - 版本管理`);
    console.log(`  GET  ${API_PREFIX}/version-rules          - 版本规则`);
    console.log(`  GET  ${API_PREFIX}/baselines              - 基线管理`);
    console.log(`  GET  ${API_PREFIX}/archives               - 归档管理`);
    console.log(`  GET  ${API_PREFIX}/audit/logs             - 审计日志`);
    console.log(`  GET  ${API_PREFIX}/roles                  - 角色管理`);
    console.log(`  GET  ${API_PREFIX}/permissions            - 权限定义`);
    console.log(`  GET  ${API_PREFIX}/departments            - 部门管理`);
    console.log(`  GET  ${API_PREFIX}/users                  - 用户管理`);
    console.log(`  GET  ${API_PREFIX}/sessions               - 会话管理`);
    console.log(`  GET  ${API_PREFIX}/notifications           - 通知系统`);
    console.log(`  GET  ${API_PREFIX}/backups                - 备份管理`);
    console.log(`  GET  ${API_PREFIX}/reports                - 报表管理`);
    console.log(`  GET  ${API_PREFIX}/statistics             - 统计看板`);
    console.log(`  GET  ${API_PREFIX}/system                 - 系统配置`);
    console.log(`  GET  ${API_PREFIX}/risk-warnings          - 风险预警`);
    console.log(`  GET  ${API_PREFIX}/compliance             - 合规检查`);
    console.log(`  GET  ${API_PREFIX}/integrity              - 完整性校验`);
    console.log(`  ALL  ${API_PREFIX}/gitea/*               - Gitea API 代理`);
    console.log('');
    console.log('默认账号:');
    console.log('  用户名: root / admin');
    console.log('  密码: 使用 Gitea 账号密码');
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
