# 项目代码文件拓扑

> **图例**  
> `[DB]` &nbsp;— 直接操作数据库（含 `db('table')` 查询）  
> `[API]` — 调用外部 API（Gitea API 或 BFF API）  
> 无标记 — 纯逻辑处理，不涉及外部数据访问

---

## 根目录

```
gov-code-manager/
│
├── package.json                    # 根依赖：concurrently，脚本管理
├── package-lock.json               # 根依赖版本锁
├── .gitignore                      # 排除 node_modules / dist / .env
├── .env.example                    # 环境变量模板
├── .dockerignore                   # Docker 构建排除
│
├── docker-compose.yml              # 生产部署：nginx(front) + bff
├── docker-compose.dev.yml          # 开发环境：Vite HMR
│
├── start.bat / start.sh            # 一键启动脚本
├── deploy.sh                       # 部署脚本
│
├── docs/
│   ├── SYSTEM_DESIGN.md            # 系统设计报告（v3.0）
│   ├── API_SPEC.md                 # API 接口文档
│   └── PROJECT_TOPOLOGY.md         # 本文件
│
└── README.md                       # 项目说明
```

---

## 前端 `front/`

> 前端不直接操作数据库，所有数据通过 `[API]` 请求 BFF 获取

```
front/
│
├── Dockerfile                      # 构建：node:18 → nginx 静态服务
├── nginx.conf                      # 代理 /api/bff → bff:8080
│
├── package.json                    # 依赖：Vue3 / ElementPlus / Pinia / Axios / Vite
├── package-lock.json               # 版本锁
│
├── .env                            # 开发环境变量
├── .env.production                 # 生产环境变量
├── .dockerignore
│
├── vite.config.js                  # Vite 配置：port 3000，代理 → 127.0.0.1:8080
│
└── src/
    │
    ├── main.js                     # 入口：注册 ElementPlus / Pinia / Router
    ├── App.vue                     # 根组件：导航 + 侧边栏 + 主内容区 + 通知
    ├── config.js                   # 统一配置：API_BASE_URL / GITEA_URL
    │
    ├── router/
    │   └── index.js                # 22 条路由 + 三层守卫
    │
    ├── stores/                     # ─── Pinia 状态管理 ───
    │   ├── user.js                 # 认证 / 权限 / 角色
    │   ├── repo.js                 # 仓库列表缓存
    │   ├── approval.js             # 审批流程
    │   ├── audit.js                # 审计日志 / 预警
    │   ├── baseline.js             # 基线 / 归档
    │   ├── system.js               # 仪表盘 / 系统状态
    │   └── index.js                # Pinia 实例
    │
    ├── api/                        # ─── [API] Axios HTTP 封装 ───
    │   ├── index.js      [API]     # 双通道实例 + 错误拦截器
    │   ├── user.js       [API]     # 登录 / 登出 / 用户信息
    │   ├── bff.js        [API]     # BFF 业务 API
    │   ├── admin.js      [API]     # 系统管理 API
    │   ├── audit.js      [API]     # 审计 API
    │   ├── gitea.js      [API]     # Gitea API
    │   ├── repos.js      [API]     # 仓库列表
    │   ├── repo.js       [API]     # 仓库操作
    │   ├── branches.js   [API]     # 分支管理
    │   ├── merge.js      [API]     # 合并请求
    │   ├── approval.js   [API]     # 审批相关
    │   ├── versions.js   [API]     # 版本列表
    │   └── version.js    [API]     # 版本创建
    │
    ├── views/                      # ─── 页面组件 (24 个) ───
    │   ├── login/
    │   │   └── index.vue           # 登录（毛玻璃卡片 + 全屏背景）
    │   ├── dashboard/
    │   │   └── index.vue           # 工作台（按角色显示内容）
    │   ├── repos/
    │   │   ├── index.vue           # 仓库列表
    │   │   ├── create.vue          # 创建仓库
    │   │   └── detail.vue          # 仓库详情（多标签页）
    │   ├── branches/
    │   │   ├── index.vue           # 分支列表
    │   │   └── merge.vue           # 合并请求（仅自己）
    │   ├── versions/
    │   │   ├── index.vue           # 版本列表
    │   │   ├── baseline.vue        # 基线管理
    │   │   └── archive.vue         # 归档管理
    │   ├── approval/
    │   │   ├── pending.vue         # 待我审批
    │   │   ├── my-requests.vue     # 我的申请
    │   │   └── history.vue         # 审批历史
    │   ├── audit/
    │   │   ├── logs.vue            # 操作日志
    │   │   ├── reports.vue         # 审计报表
    │   │   └── warning.vue         # 风险预警
    │   ├── admin/
    │   │   ├── users.vue           # 用户管理
    │   │   ├── roles.vue           # 角色权限
    │   │   ├── depts.vue           # 部门管理
    │   │   └── backup.vue          # 备份管理
    │   ├── profile/
    │   │   └── index.vue           # 个人中心
    │   ├── settings/
    │   │   └── index.vue           # 系统设置
    │   ├── 404.vue                 # 404 页面
    │   └── login.vue               #（旧版登录页）
    │
    ├── assets/
    │   └── VCG211511234644.jpg     # 登录页背景图
    │
    └── styles/
        ├── main.scss               # SCSS 源文件
        └── main.css                # 编译后样式
```

---

## 后端 `bff/`

```
bff/
│
├── Dockerfile                      # node:18-alpine + curl
├── .env                     [DB]   # DB / Gitea / JWT / CORS 配置
├── .dockerignore
│
├── package.json                    # Express / Knex / PG / bcryptjs / JWT
├── package-lock.json               # 版本锁
│
└── src/
    │
    ├── index.js                    # 入口：8 中间件 + 27 路由 + 启动
    │
    ├── config/
    │   └── index.js         [DB]   # 数据库连接配置
    │
    ├── middleware/                  # ─── 中间件 (8 个) ───
    │   ├── auth.js          [DB]   # JWT 认证 + 角色 / 权限检查
    │   ├── permission.js            # 25 种权限定义
    │   ├── audit.js         [DB]   # SHA-256 审计哈希链
    │   ├── auditLogger.js   [DB]   # 简化版审计日志
    │   ├── deptIsolation.js [DB]   # 部门数据隔离
    │   ├── rateLimiter.js           # 登录 / API 限流
    │   ├── requestLogger.js         # 请求日志
    │   └── errorHandler.js          # 全局错误处理
    │
    ├── database/                    # ─── 数据库核心 ───
    │   ├── connection.js    [DB]   # ★ 核心：Knex 连接 + 15 张表自动建表 + 种子数据 + 模拟 DB
    │   ├── migrate.js       [DB]   # 迁移脚本
    │   └── seed.js          [DB]   # 种子数据
    │
    ├── routes/                      # ─── 路由模块 (27 个) ───
    │   │
    │   │  认证
    │   ├── auth.js        [DB][API] # 登录 / 登出 / /auth/me
    │   ├── downloadToken       [API] # Gitea 下载令牌
    │   │
    │   │  仓库 & 版本管控
    │   ├── repos.js       [DB][API] # 仓库列表 + 部门密级过滤
    │   ├── repoMeta.js         [DB] # 仓库元数据 CRUD
    │   ├── branches.js         [API] # 分支 / PR（纯 Gitea 代理）
    │   ├── versions.js         [DB] # 版本管理
    │   ├── versionRules.js     [DB] # 版本编号规则
    │   ├── deprecations.js     [DB] # 版本废弃
    │   ├── baselines.js  [DB][API] # 基线 + Gitea Tag
    │   └── archives.js         [DB] # 归档管理
    │   │
    │   │  审批流程
    │   ├── approvals.js   [DB][API] # 多步审批 + 后置操作
    │   └── approvalFlows.js   [DB] # 审批模板
    │   │
    │   │  审计 & 合规
    │   ├── audit.js             [DB] # 审计日志查询
    │   ├── reports.js           [DB] # 审计报表
    │   ├── riskWarnings.js      [DB] # 风险预警
    │   ├── compliance.js        [DB] # 合规检查
    │   └── integrity.js         [DB] # 审计链校验
    │   │
    │   │  系统管理
    │   ├── users.js       [DB][API] # 用户 CRUD + Gitea 同步
    │   ├── roles.js             [DB] # 角色 CRUD
    │   ├── permissions.js       [DB] # 权限定义
    │   ├── departments.js       [DB] # 部门 CRUD
    │   ├── sessions.js          [DB] # 会话管理
    │   ├── notifications.js     [DB] # 通知 CRUD
    │   ├── backups.js           [DB] # 备份管理
    │   ├── statistics.js [DB][API] # 统计 + Gitea 数据
    │   └── system.js            [DB] # 系统配置
    │   │
    │   │  代理
    │   └── gitea.js           [API] # Gitea 透传代理
    │
    ├── services/
    │   ├── adminTokenCache.js      # 管理员 Gitea Token 缓存（纯内存）
    │   ├── credentialStore.js      # [C-03] 服务端凭据存储（JWT 不再携带凭据）
    │   └── riskDetector.js         # 风险检测引擎：4 条规则（登录异常/高频下载/越权/泄露）
    │
    ├── stores/
    │   └── user.js                  # 内部用户存储（纯内存）
    │
    ├── init-data.sql                # SQL 初始化数据
    ├── init-tables.sql              # SQL 建表脚本
    ├── init-database.bat            # Windows 数据库初始化脚本
    └── init-database.sh             # Linux 数据库初始化脚本
```

---

## 数据库（15 张表）

```
openGauss ─── 配置源：bff/.env → DB_HOST / DB_PORT / DB_NAME
│
├── user_profiles       # 用户扩展信息
├── roles               # 角色定义（兼容两套列名）
├── departments         # 部门树形结构
│
├── approvals           # 审批主表
├── approval_records    # 审批操作记录
├── approval_flows      # 审批流程模板
│
├── baselines           # 基线管理
├── archives            # 归档管理
│
├── audit_logs          # 审计日志（SHA-256 哈希链防篡改）
├── sessions            # 会话
├── notifications       # 通知
├── risk_warnings       # 风险预警
├── system_config       # 系统配置
├── version_rules       # 版本编号规则
└── repo_metadata       # 仓库→部门→密级映射
```

---

## 数据访问链路

```
┌─ 前端 ────────────────────────────────────────────────────┐
│  views/*.vue → stores/*.js → api/*.js                     │
│                              │                             │
│                      [API]   │  HTTP (Axios)               │
└──────────────────────────────┼─────────────────────────────┘
                               ▼
┌─ BFF 路由 ───────────────────────────────────────────────────┐
│  routes/*.js                                                  │
│     ├── [DB]  db('table_name')  ─────────→  openGauss        │
│     └── [API] fetch(giteaUrl) ──────────→  Gitea 云服务器    │
│                                                                │
│  混合示例：                                                    │
│    auth.js      [DB]查 user_profiles + [API]Gitea 认证        │
│    approvals.js [DB]查 approvals 表  + [API]创建 Tag/Release │
│    users.js     [DB]增删改用户       + [API]同步 Gitea 账户  │
│    branches.js  [API]仅调 Gitea      （不操作数据库）         │
└────────────────────────────────────────────────────────────────┘
```

## 部署架构

```
┌─ 本地机器 ──────────┐     ┌─ 云服务器 ──────────────┐
│                      │     │                         │
│  frontend :3000      │     │  Gitea      :3000       │
│  (Vite / Nginx)      │     │  openGauss  :5432       │
│                      │     │                         │
│  bff       :8080     │────▶│                         │
│  (Express.js)        │     │                         │
│                      │     │                         │
└──────────────────────┘     └─────────────────────────┘
```

## 文件统计

| 目录 | 数量 |
|------|:----:|
| 前端 API 封装 | 13 |
| 前端状态管理 | 7 |
| 前端页面组件 | 24 |
| 后端路由模块 | 27 |
| 后端中间件 | 8 |
| 数据库表 | 15 |
