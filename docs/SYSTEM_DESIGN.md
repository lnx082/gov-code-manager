# 党政软件版本管控平台 — 系统设计报告

> **文档版本**: v3.0
> **日期**: 2026-07-13
> **技术栈**: Vue 3 + Element Plus + Pinia / Express + Knex + openGauss / Gitea API

---

## 目录

1. [系统概述](#1-系统概述)
2. [架构设计](#2-架构设计)
3. [前端设计](#3-前端设计)
4. [后端设计](#4-后端设计)
5. [数据库设计](#5-数据库设计)
6. [接口设计](#6-接口设计)
7. [安全设计](#7-安全设计)
8. [部署设计](#8-部署设计)

---

## 1. 系统概述

### 1.1 项目背景

党政机关软件版本管控平台（Gov-Code-Manager）是为满足党政机关对软件版本管控的合规需求而设计的。系统需符合**等保2.0三级要求**，实现全流程审计溯源、多级审批流程、版本管控规范化。

### 1.2 核心功能

| 功能模块 | 说明 |
|---------|------|
| 安全可控 | 符合等保2.0三级要求，全流程审计溯源 |
| 合规审批 | 多级审批流程，版本管控规范化 |
| 信创适配 | 国产化环境适配，麒麟鲲鹏兼容 |
| 全程溯源 | 防篡改审计日志，操作永久留存 |
| 权限管控 | 细粒度权限控制，部门数据隔离 |
| 版本管理 | 标准化版本编号，基线固化封存 |

### 1.3 角色权限

| 角色 | 权限范围 |
|------|---------|
| 系统管理员 (admin) | 全系统管理，全部权限 |
| 项目管理员 (project_manager) | 仓库和版本管理 |
| 开发人员 (developer) | 代码提交和分支操作 |
| 审计人员 (auditor) | 查看审计日志和报表 |

---

## 2. 架构设计

### 2.1 总体架构

系统采用 **BFF（Backend For Frontend）** 架构模式，前端不直接操作数据库或 Gitea，所有业务逻辑通过 BFF 中间层封装。

```
┌──────────────────────────────────────────────────────────────────┐
│                        客户端 (浏览器)                            │
│                  Vue 3 + Element Plus SPA                        │
│             24 页面 | 13 API模块 | 7 Pinia Stores                 │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP REST (Axios)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BFF 中间层 (Node.js/Express)                   │
│              26 路由模块 | 8 中间件 | JWT 认证                    │
│              中间件链 + 权限体系 + 审计日志                       │
└──────────┬──────────────────┬──────────────────┬────────────────┘
           ▼                  ▼                  ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │  Gitea   │       │ openGauss│       │ 审计日志  │
    │  代码仓库 │       │ 业务数据库│       │ 防篡改链  │
    │  SQLite  │       │  PostgreSQL│     │ SHA-256  │
    └──────────┘       └──────────┘       └──────────┘
```

### 2.2 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 架构模式 | BFF | 前端统一网关，封装后端复杂性，适配多种客户端 |
| 前端框架 | Vue 3 + Composition API | 响应式数据绑定，组合式 API 更好的代码组织 |
| UI 框架 | Element Plus | 企业级组件库，完整表单/表格/弹窗支持 |
| 状态管理 | Pinia | 轻量级，完整 TypeScript 支持，模块化 Store |
| 后端框架 | Express.js | Node.js 生态成熟，中间件机制灵活 |
| 数据库 | openGauss | 国产数据库要求，兼容 PostgreSQL 协议 |
| 代码仓库 | Gitea | 自托管 Git 服务，API 完整，国产化 |
| 认证方式 | JWT + Gitea Basic Auth | 无状态认证，双通道兜底 |
| 审计日志 | SHA-256 哈希链 | 防篡改，可验证完整性 |

### 2.3 数据流全景

```
用户操作 → Vue 组件 → API 调用 (Axios)
  → 请求拦截器 (注入 JWT Token)
  → BFF 路由处理
    → 认证中间件 (JWT 验证 + 用户状态检查)
    → 权限中间件 (角色/权限检查)
    → 业务处理
      → 查询 openGauss (Knex ORM)
      → 调用 Gitea API (仓库/分支/PR 操作)
    → 审计中间件 (记录请求到审计日志链)
  → 响应拦截器 (统一错误处理)
  → Vue 组件更新
```

---

## 3. 前端设计

### 3.1 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.4+ | 前端框架，Composition API + `<script setup>` |
| Element Plus | 2.5+ | UI 组件库，国际化 zh-cn |
| Pinia | 2.1+ | 状态管理 |
| Vue Router | 4.2+ | 前端路由，History 模式 |
| Axios | 1.6+ | HTTP 客户端，双实例（BFF + Gitea） |
| Vite | 5.0+ | 构建工具，开发服务器代理 |
| ECharts | 5.4+ | 图表可视化 |

### 3.2 目录结构

```
front/src/
├── api/          # API 调用封装 (13 个模块)
│   ├── index.js  # Axios 实例 + 拦截器
│   ├── bff.js    # BFF 业务 API
│   ├── user.js   # 用户认证 API
│   ├── admin.js  # 系统管理 API
│   ├── audit.js  # 审计 API
│   └── ...       # 各功能模块 API
├── stores/       # Pinia 状态管理 (7 个)
│   ├── user.js   # 用户认证/权限
│   ├── approval.js
│   ├── audit.js
│   ├── baseline.js
│   ├── repo.js
│   ├── system.js
│   └── index.js  # Pinia 实例
├── router/       # 路由配置
│   └── index.js  # 22 条路由 + 三层守卫
├── views/        # 页面组件 (24 个)
│   ├── login/    # 登录页面
│   ├── dashboard/# 工作台
│   ├── repos/    # 仓库管理
│   ├── branches/ # 分支管理
│   ├── versions/ # 版本管理
│   ├── approval/ # 审批管理
│   ├── audit/    # 审计管理
│   ├── admin/    # 系统管理
│   └── profile/  # 个人中心
├── assets/       # 静态资源
└── styles/       # 全局样式
```

### 3.3 页面路由设计

| 路由路径 | 页面 | 权限要求 | 说明 |
|---------|------|---------|------|
| `/login` | 登录 | 公开 | 毛玻璃卡片 + 全屏背景 |
| `/dashboard` | 工作台 | 登录 | 按角色显示不同内容 |
| `/repos` | 仓库列表 | 登录 | Gitea 数据 + 部门过滤 |
| `/repos/create` | 创建仓库 | admin/pm | 选择部门/密级 |
| `/repos/:owner/:name` | 仓库详情 | 登录 | 多标签页 |
| `/branches` | 分支列表 | 登录 | 按仓库过滤 |
| `/branches/merge` | 合并请求 | 登录 | 仅显示自己的 |
| `/versions` | 版本列表 | 登录 | 按仓库过滤 |
| `/versions/baseline` | 基线管理 | 登录 | 创建/变更/冻结 |
| `/versions/archive` | 归档管理 | 登录 | 归档/恢复 |
| `/approval/pending` | 待审批 | admin/pm | 审批操作 |
| `/approval/my-requests` | 我的申请 | 登录 | 申请列表 |
| `/approval/history` | 审批历史 | 登录 | 历史记录 |
| `/audit/logs` | 操作日志 | audit:view | 审计查询 |
| `/audit/reports` | 审计报表 | audit:view | 报表生成 |
| `/audit/warning` | 风险预警 | audit:view | 预警处理 |
| `/admin/users` | 用户管理 | admin:manage | CRUD + 重置密码 |
| `/admin/roles` | 角色权限 | admin:manage | 权限查看 |
| `/admin/depts` | 部门管理 | admin:manage | 树形结构 |
| `/admin/backup` | 备份管理 | admin:manage | 创建/恢复 |
| `/profile` | 个人中心 | 登录 | 独立 API 加载 |
| `/settings` | 系统设置 | 登录 | 配置 |

### 3.4 路由守卫设计

三层守卫机制，按顺序执行：

```
router.beforeEach:
  ① 未认证检查
     → !isAuthenticated 且目标需要认证 → 跳转 /login
  ② 权限检查
     → 目标有 meta.permission 且用户无此权限 → 拦截 + 提示
  ③ 审计人员白名单
     → role === 'auditor' 且目标不在白名单 → 跳回 /dashboard
     
  审计人员白名单路径:
    /dashboard, /profile, /settings
    /audit/logs, /audit/reports, /audit/warning
  其他路径一律拦截
```

### 3.5 认证流程（前端）

```
login/index.vue:
  handleLogin()
    → userStore.loginAction(username, password)
      → POST /api/bff/auth/login
      → 返回 { token, user }
      → token → sessionStorage
      → userInfo.value = res.data.user
      → role = computed(userInfo.value?.role)
    → userStore.initUser()  (刷新数据)
      → GET /api/bff/auth/me
      → userInfo.value = res.data (数据库最新数据)
    → router.push('/dashboard')
```

**关键设计**：登录后调用 `initUser()` 从 `/auth/me` 重新加载，确保角色/部门/密级等数据来自数据库而非登录响应缓存。

### 3.6 侧边栏权限控制

```
v-show="userStore.userInfo && userStore.role === 'admin'"

Dashboard ─── 始终显示
仓库管理 ─── role ∈ {admin, pm, developer}
分支管理 ─── role ∈ {admin, pm, developer}
版本管理 ─── role ∈ {admin, pm, developer}
审批管理 ─── role ∈ {admin, pm, developer}
审计管理 ─── role ∈ {admin, auditor}
系统管理 ─── hasPermission('admin:manage')
```

### 3.7 状态管理设计

**user Store（核心）：**
```javascript
state:     token, userInfo, permissions
computed:  isAuthenticated, username, role, roleName
actions:   loginAction, initUser, logout
methods:   hasPermission(permission)
```

**关键计算逻辑：**
```javascript
role = computed(() => userInfo.value?.role || '')
roleName = computed(() => {
  const roleMap = { 'admin':'系统管理员', 'project_manager':'项目管理员', 
                    'developer':'开发人员', 'auditor':'审计人员' }
  return roleMap[userInfo.value?.role] || userInfo.value?.roleName || '开发人员'
})
```

---

## 4. 后端设计

### 4.1 技术选型

| 技术 | 用途 |
|------|------|
| Express.js | Web 框架 |
| Knex.js | SQL 查询构建器（openGauss/PostgreSQL） |
| JWT (jsonwebtoken) | 无状态认证 |
| bcryptjs | 密码哈希 |
| helmet | HTTP 安全头 |
| cors | 跨域配置 |
| express-rate-limit | 接口限流 |
| morgan | HTTP 请求日志 |

### 4.2 目录结构

```
bff/src/
├── index.js              # 应用入口，中间件注册，路由挂载
├── config/index.js       # 集中配置（数据库/JWT/Gitea/审计）
├── database/
│   ├── connection.js     # 数据库连接 + 自动建表迁移 + 种子数据 + 模拟数据库
│   ├── migrate.js        # 迁移脚本
│   └── seed.js           # 种子数据
├── middleware/            # 8 个中间件
│   ├── auth.js           # JWT 验证 + 权限检查
│   ├── permission.js     # 权限定义（25种）
│   ├── audit.js          # 审计日志链
│   ├── rateLimiter.js    # 限流
│   ├── deptIsolation.js  # 部门隔离
│   ├── requestLogger.js  # 请求日志
│   └── errorHandler.js   # 错误处理
├── routes/               # 26 个路由模块
└── services/             # 服务层
    └── adminTokenCache.js
```

### 4.3 中间件链

```
请求进入 → helmet → cors → json/urlencoded → morgan
  → requestLogger → auditMiddleware → 路由匹配
  → [authenticate → requirePermission] → 业务处理
  → 响应返回
  → auditMiddleware 记录日志
  → 异常 → errorHandler
```

### 4.4 认证设计

**登录流程（双通道认证）：**

```
POST /auth/login:
  username + password
    → ① Gitea Basic Auth（主要）
      → GET /api/v1/user with Basic base64(username:password)
      → 成功 → 获取 giteaUser (id, login, is_admin)
    
    → ② 本地密码验证（兜底）
      → bcrypt.compare(password, user_profiles.password_hash)
      → 匹配 → 用本地数据构造 giteaUser
      → 后台同步密码到 Gitea（自愈机制）
    
    → ③ 用户状态检查
      → is_active === false → 403 账号已注销
      → account_locked === true → 403 账号已锁定
    
    → ④ 查找/创建用户记录
      → 优先 user_id 匹配
      → 兜底 gitea_username 匹配（LOWER 忽略大小写）
      → 未找到 → 创建新记录（设置默认 role）
    
    → ⑤ 签发 JWT
      payload: { userId, username, roleCode, permissions, giteaToken }
      expires: 7d
    
    → ⑥ 返回
      { token, user: { id, username, role, roleName, 
                       departmentName, secretLevel, lastLoginTime } }
```

**`/auth/me` 端点：**
从数据库读取最新用户信息（角色、部门名称、保密等级、最后登录时间），确保数据准确性。

### 4.5 审批引擎设计

```
创建审批申请:
  body: { operationType, title, description, repoOwner, repoName, ... }
  → 自动匹配默认审批流程模板
  → 创建审批记录: status=pending, current_step=1
  
审批处理:
  POST /approvals/:id/process
  body: { action, body }
  
  action = reject:
    → status = 'rejected'
    → 结束
  
  action = approve:
    → 还有下一步:
      → current_step++
      → status = 'pending'（等待下一步审批人）
    → 最后一步:
      → status = 'approved'
      → 执行后置操作:
        version_release → 创建 Gitea Tag + Release
        baseline_create → 创建基线记录
        baseline_archive → 归档仓库（设为只读）
        baseline_change → 修改基线版本号
        baseline_freeze → 锁定基线 + 冻结仓库
```

### 4.6 审计日志链设计

```
每次 API 请求 → audit.js 拦截 res.send:

  ① 获取上一条日志的 integrity_hash
  ② 计算新哈希:
     hashInput = logId + JSON.stringify({userId, action, path, timestamp}) + prevHash
     integrityHash = SHA256(hashInput)
  ③ 写入 audit_logs:
     { log_id, user_id, action_type, request_path, response_status,
       integrity_hash, prev_hash, ... }
  
  链完整性验证:
    遍历日志，逐条校验 prev_hash == 上条的 integrity_hash
    任何断裂 → 报告被篡改的位置
```

### 4.7 用户角色管理

**创建用户流程：**
```
POST /users (requireAdmin):
  body: { username, email, password, roleCode, departmentId, secretLevel }
  → 检查用户名是否已存在（含软删除处理）
  → 调用 Gitea API 创建 Gitea 账户
  → 创建本地 user_profiles 记录
  → 自动添加为部门仓库协作者
```

**角色权限定义（25种）：**
```
repo:view/create/edit/delete/download
branch:view/create/delete/merge
version:view/create/delete
approval:view/create/process/config
baseline:view/create/lock
archive:view
audit:view/export
user:view
admin:manage
backup:manage
```

---

## 5. 数据库设计

### 5.1 表结构总览（15 张表）

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| `user_profiles` | 用户扩展信息 | user_id, gitea_username, password_hash, role_code, department_id, secret_level |
| `roles` | 角色定义 | role_code, role_name, permissions, is_system（兼容两套列名） |
| `departments` | 部门管理 | name, code, parent_id, leader |
| `approvals` | 审批申请主表 | operation_type, title, status, current_step, applicant_user_id |
| `approval_records` | 审批操作记录 | approval_id, step, reviewer_user_id, action, comment |
| `approval_flows` | 审批流程模板 | name, steps, applicable_operations, is_default |
| `baselines` | 基线管理 | name, version, tag_name, status, lock_status |
| `archives` | 归档管理 | tag_name, archive_type, storage_path |
| `audit_logs` | 审计日志（防篡改） | integrity_hash, prev_hash, log_id, user_id, action_type |
| `sessions` | 用户会话 | session_id, user_id, expires_at |
| `notifications` | 通知管理 | user_id, type, title, is_read |
| `risk_warnings` | 风险预警 | level, type, status, triggered_rule |
| `system_config` | 系统配置 | config_key, config_value |
| `version_rules` | 版本编号规则 | default_pattern, auto_increment_rules |
| `repo_metadata` | 仓库元数据 | repo_owner, repo_name, department_id, secret_level, display_name |

### 5.2 关键表设计

**user_profiles：**
```sql
CREATE TABLE user_profiles (
  profile_id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  gitea_username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255),
  role_code VARCHAR(50) DEFAULT 'user',
  department_id INTEGER,
  secret_level VARCHAR(20) DEFAULT 'internal',
  is_active BOOLEAN DEFAULT TRUE,
  account_locked BOOLEAN DEFAULT FALSE,
  permissions TEXT,
  ...
);
```

**audit_logs（防篡改哈希链关键结构）：**
```sql
CREATE TABLE audit_logs (
  log_id VARCHAR(100) PRIMARY KEY,
  user_id INTEGER,
  action_type VARCHAR(50) NOT NULL,
  request_path VARCHAR(500),
  response_status INTEGER,
  integrity_hash VARCHAR(64) NOT NULL,  -- SHA256(当前记录)
  prev_hash VARCHAR(64),                -- SHA256(上一条记录)
  ...
);
```

### 5.3 roles 表兼容性设计

`roles` 表在迭代过程中存在两套列名，系统自动处理兼容：

| 老版本 | 新版本 | 兼容方案 |
|--------|--------|---------|
| `code` | `role_code` | 启动时自动补齐缺失列 + 数据回填 |
| `name` | `role_name` | JOIN 时使用 `role_code`，回填 `code` |

---

## 6. 接口设计

### 6.1 通用响应格式

```json
{
  "code": 200,          // 业务状态码
  "message": "成功",     // 提示信息
  "data": { ... }       // 响应数据
}
```

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证/令牌过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 数据冲突 |
| 429 | 请求过频繁 |
| 500 | 服务器内部错误 |

### 6.2 接口概览

```
POST   /api/bff/auth/login            # 用户登录
POST   /api/bff/auth/logout           # 用户登出
GET    /api/bff/auth/me               # 获取当前用户信息

GET    /api/bff/repos                 # 仓库列表（权限过滤）
GET    /api/bff/branches              # 分支列表（Gitea 代理）
GET    /api/bff/approvals             # 审批列表
POST   /api/bff/approvals             # 创建审批
GET    /api/bff/approvals/pending     # 待审批列表
POST   /api/bff/approvals/:id/process # 处理审批

GET    /api/bff/audit/logs            # 审计日志列表
POST   /api/bff/audit/verify          # 验证审计链完整性

GET    /api/bff/users                 # 用户列表
POST   /api/bff/users                 # 创建用户
PUT    /api/bff/users/:id             # 更新用户
DELETE /api/bff/users/:id             # 删除用户

GET    /api/bff/roles                 # 角色列表
GET    /api/bff/departments           # 部门列表

GET    /api/bff/statistics/dashboard  # 仪表盘统计
GET    /api/bff/statistics/system     # 系统状态
```

### 6.3 BFF 与 Gitea API 协作模式

系统采用混合数据源模式，关键数据从 BFF 数据库获取，Git 操作通过 Gitea API：

| 操作 | 数据源 | 说明 |
|------|--------|------|
| 用户认证 | Gitea API | Basic Auth 验证密码 |
| 仓库列表 | BFF 数据库 + Gitea API | 数据库存权限映射，Gitea 存仓库数据 |
| 审批流程 | BFF 数据库 | 完整审批生命周期 |
| 分支/PR | Gitea API | 创建/合并/列表 |
| 审计日志 | BFF 数据库 | SHA-256 哈希链 |

---

## 7. 安全设计

### 7.1 认证安全

| 措施 | 说明 |
|------|------|
| JWT 无状态认证 | 7 天有效期，包含用户角色和权限 |
| 双通道认证 | Gitea 主认证 + 本地 bcrypt 兜底 |
| 登录限流 | 5 次/分钟，防止暴力破解 |
| 密码加密 | bcrypt 10 轮哈希 |
| 锁定机制 | 多次失败后自动锁定账号 |

### 7.2 权限控制

| 层级 | 控制点 | 说明 |
|------|--------|------|
| 路由层 | 路由守卫 | 未认证重定向，无权限拦截 |
| 中间件层 | requirePermission | 25 种细粒度权限检查 |
| 数据层 | 部门隔离 | 非管理员只看本部门数据 |
| 界面层 | 侧边栏 v-show | 按角色动态显示菜单 |

### 7.3 审计安全

| 措施 | 说明 |
|------|------|
| SHA-256 哈希链 | 每条日志包含上条哈希值，防篡改 |
| 完整记录 | 所有 API 操作自动记录 |
| 链校验 | 提供验证接口，可随时检查日志完整性 |
| 长期保留 | 默认 10 年保留期 |

### 7.4 API 安全

| 措施 | 说明 |
|------|------|
| helmet | HTTP 安全头（CSP/XSS/点击劫持） |
| CORS | 限定允许的跨域来源 |
| 请求体限制 | 10MB 上限 |
| 参数验证 | 必填字段检查，长度校验 |

---

## 8. 部署设计

### 8.1 Docker 部署架构

```
┌──────────────────────────────────────┐
│           docker-compose.yml          │
│                                      │
│  ┌─────────────┐   ┌──────────────┐  │
│  │   frontend   │   │     bff      │  │
│  │  nginx:80   │──▶│  node:8080   │  │
│  │  静态文件    │   │  Express.js  │  │
│  └─────────────┘   └──────┬───────┘  │
│                           │          │
│                    ┌──────▼───────┐  │
│                    │  openGauss   │  │
│                    │  5432 (外部) │  │
│                    └──────────────┘  │
└──────────────────────────────────────┘
```

### 8.2 nginx 配置

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    
    location / {
        try_files $uri $uri/ /index.html;  # SPA 路由
    }
    
    location /api/bff/ {
        proxy_pass http://bff:8080/api/bff/;  # 代理到 BFF
    }
}
```

### 8.3 Dockerfile

**前端构建：**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

**BFF 构建：**
```dockerfile
FROM node:18-alpine
RUN apk add --no-cache curl   # 健康检查
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### 8.4 手动部署

```bash
# 1. 启动后端
cd bff
npm start          # 端口 8080

# 2. 启动前端（开发模式）
cd front
npm run dev        # 端口 3000，Vite 代理 → 8080

# 3. 生产构建
cd front
npm run build      # 输出 dist/
# 用 nginx 或其他静态服务器托管 dist/ 目录
# 配置 /api/bff 反向代理到 BFF 8080 端口
```

---

## 附录

### A. 项目文件总览

```
项目总数: 90 个源文件
├── 前端源码: 48 个
│   ├── API 模块: 13 个
│   ├── Store: 7 个
│   ├── 页面: 24 个
│   ├── 路由: 1 个
│   ├── 入口: 2 个
│   └── 样式: 1 个
├── 后端源码: 40 个
│   ├── 路由模块: 26 个
│   ├── 中间件: 8 个
│   ├── 数据库: 3 个
│   └── 配置: 3 个
├── Docker: 5 个
└── 配置: 10 个
```

### B. 依赖总览

```
前端: 11 生产依赖 + 3 开发依赖 = 14 个包
  核心: vue, vue-router, pinia, element-plus, axios, echarts
  工具: lunar-javascript, pinyin, pinyin-pro, js-cookie
  构建: vite, @vitejs/plugin-vue, sass

后端: 12 生产依赖 = 12 个包
  核心: express, knex, pg
  安全: bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit
  工具: dotenv, morgan, uuid, pdfkit
```

### C. 角色权限矩阵

| 功能 | 系统管理员 | 项目管理员 | 开发人员 | 审计人员 |
|------|:---------:|:---------:|:-------:|:-------:|
| 工作台 | ✅ 全部 | ✅ 全部 | ✅ 部分 | ✅ 仅审计统计 |
| 仓库列表/详情 | ✅ | ✅ | ✅ | ❌ |
| 创建仓库 | ✅ | ✅ | ❌ | ❌ |
| 分支管理 | ✅ | ✅ | ✅ | ❌ |
| 合并请求 | ✅ | ✅ | ✅ | ❌（仅查看自己的） |
| 版本管理 | ✅ | ✅ | ✅ | ❌ |
| 审批管理 | ✅ | ✅ | 部分 | ❌ |
| 审计管理 | ✅ | ❌ | ❌ | ✅ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ |
| 角色管理 | ✅ | ❌ | ❌ | ❌ |
| 部门管理 | ✅ | ❌ | ❌ | ❌ |
| 备份管理 | ✅ | ❌ | ❌ | ❌ |
| 个人中心 | ✅ | ✅ | ✅ | ✅ |
