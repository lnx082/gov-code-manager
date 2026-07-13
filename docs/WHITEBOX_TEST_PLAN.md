# 党政软件版本管控平台 — 白盒测试计划

> **文档版本**: 1.0  
> **创建日期**: 2026-07-13  
> **测试类型**: 白盒测试（API 集成测试 + 业务流程测试）  
> **覆盖范围**: BFF 后端 + 前端路由 + 数据库操作 + Gitea 代理

---

## 目录

1. [系统架构概述](#1-系统架构概述)
2. [测试环境准备](#2-测试环境准备)
3. [测试用例索引](#3-测试用例索引)
4. [模块A：用户认证与授权](#4-模块a用户认证与授权)
5. [模块B：仓库管理](#5-模块b仓库管理)
6. [模块C：分支管理](#6-模块c分支管理)
7. [模块D：合并分支](#7-模块d合并分支)
8. [模块E：版本管理](#8-模块e版本管理)
9. [模块F：基线管理](#9-模块f基线管理)
10. [模块G：归档管理](#10-模块g归档管理)
11. [模块H：审批流程](#11-模块h审批流程)
12. [模块I：审计日志](#12-模块i审计日志)
13. [模块J：权限与越权测试](#13-模块j权限与越权测试)
14. [模块K：前端路由与页面测试](#14-模块k前端路由与页面测试)
15. [自动化测试脚本使用指南](#15-自动化测试脚本使用指南)

---

## 1. 系统架构概述

### 1.1 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vue 3 + Vite + Element Plus + Pinia | SPA 单页应用 |
| 路由 | Vue Router 4 (createWebHistory) | 22条路由 + 导航守卫 |
| 中间层 | Node.js + Express (BFF) | 端口 8080，API前缀 `/api/bff` |
| 认证 | JWT (7天过期) + Gitea Basic Auth | 服务端凭据存储 credentialStore |
| 数据库 | openGauss (PostgreSQL兼容) | Knex Query Builder |
| 代码托管 | Gitea API v1 | 通过 BFF 代理访问 |

### 1.2 API 路由映射

```
POST   /api/bff/auth/login              — 用户登录
POST   /api/bff/auth/logout             — 用户登出
GET    /api/bff/auth/me                 — 获取当前用户信息
GET    /api/bff/repos                   — 仓库列表（部门+密级过滤）
GET    /api/bff/repos/:owner/:repo      — 仓库详情
GET    /api/bff/repos/:owner/:repo/branches    — 仓库分支列表
GET    /api/bff/repos/:owner/:repo/commits     — 仓库提交历史
POST   /api/bff/repos/:owner/:repo/last-commits — 批量最后提交
GET    /api/bff/repo-meta               — 仓库元数据列表
GET    /api/bff/repo-meta/visible       — 可见仓库列表
PUT    /api/bff/repo-meta/:owner/:name  — 更新仓库元数据
GET    /api/bff/branches/:owner/:repo/branches       — 分支列表
POST   /api/bff/branches/:owner/:repo/branches       — 创建分支
DELETE /api/bff/branches/:owner/:repo/branches/:branch — 删除分支
GET    /api/bff/branches/:owner/:repo/pulls          — PR 列表
POST   /api/bff/branches/:owner/:repo/pulls          — 创建 PR
POST   /api/bff/branches/:owner/:repo/pulls/:index/merge — 合并 PR
GET    /api/bff/branches/:owner/:repo/pulls/:index/files — PR 文件变更
GET    /api/bff/versions               — 版本列表
GET    /api/bff/versions/:tagName      — 版本详情
POST   /api/bff/versions               — 创建版本（提交审批）
POST   /api/bff/versions/:tagName/baseline — 标记为基线
GET    /api/bff/baselines              — 基线列表
GET    /api/bff/baselines/check        — 检查是否为基线
GET    /api/bff/baselines/:id          — 基线详情
POST   /api/bff/baselines              — 创建基线（提交审批）
POST   /api/bff/baselines/:id/lock     — 锁定/解锁基线
POST   /api/bff/baselines/:id/freeze   — 冻结基线
GET    /api/bff/archives               — 归档列表
POST   /api/bff/archives               — 创建归档
POST   /api/bff/archives/:id/restore   — 恢复归档
GET    /api/bff/approvals              — 审批列表
GET    /api/bff/approvals/pending      — 待我审批
GET    /api/bff/approvals/merge-requests — 合并请求列表
GET    /api/bff/approvals/stats/summary  — 审批统计
GET    /api/bff/approvals/by-pr/:prNumber — 按PR查询审批
GET    /api/bff/approvals/:id          — 审批详情
POST   /api/bff/approvals              — 创建审批申请
POST   /api/bff/approvals/:id/process  — 处理审批
GET    /api/bff/approval-flows         — 审批流程模板列表
GET    /api/bff/approval-flows/suggest/list — 建议审批流程
POST   /api/bff/approval-flows         — 创建审批流程
PUT    /api/bff/approval-flows/:flowId — 更新审批流程
DELETE /api/bff/approval-flows/:flowId — 删除审批流程
GET    /api/bff/audit/logs             — 审计日志列表
GET    /api/bff/audit/logs/:id         — 审计日志详情
POST   /api/bff/audit/logs/verify-integrity — 验证日志完整性
GET    /api/bff/audit/stats/operations — 操作统计
GET    /api/bff/audit/export           — 导出审计日志 CSV
GET    /api/bff/users                  — 用户列表
POST   /api/bff/users                  — 创建用户
PUT    /api/bff/users/:id              — 更新用户
DELETE /api/bff/users/:id              — 删除用户
POST   /api/bff/users/:id/reset-password — 重置密码
GET    /api/bff/roles                  — 角色列表
GET    /api/bff/departments            — 部门列表
GET    /api/bff/statistics/*           — 统计看板
GET    /api/bff/system/config          — 系统配置
PUT    /api/bff/system/config          — 更新系统配置
ALL    /api/bff/gitea/*                — Gitea API 透传代理
```

### 1.3 核心数据库表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `user_profiles` | 用户扩展表 | user_id, gitea_username, password_hash, role_code, department_id, secret_level |
| `roles` | 角色表 | role_code, role_name, permissions(JSON) |
| `departments` | 部门表 | dept_id, name, code |
| `approvals` | 审批主表 | approval_id, operation_type, status, current_step, approval_flow_id |
| `approval_records` | 审批记录表 | record_id, approval_id, step, action, comment |
| `approval_flows` | 审批流程模板 | flow_id, name, steps(JSON), is_default |
| `baselines` | 基线表 | baseline_id, name, tag_name, repo_owner, repo_name, status |
| `archives` | 归档表 | archive_id, repo_owner, repo_name, tag_name, status |
| `audit_logs` | 审计日志表 | log_id, action_type, request_path, integrity_hash, prev_hash |
| `repo_metadata` | 仓库元数据 | repo_owner, repo_name, department_id, secret_level, display_name |
| `sessions` | 会话表 | session_id, user_id, username, expires_at |
| `notifications` | 通知表 | notification_id, user_id, type, title, is_read |
| `risk_warnings` | 风险预警表 | warning_id, level, type, title, status |
| `system_config` | 系统配置表 | config_key, config_value |
| `version_rules` | 版本规则表 | default_pattern, patterns(JSON), prohibit_patterns(JSON) |

### 1.4 角色权限矩阵

| 权限 | admin | project_manager | developer | auditor |
|------|-------|-----------------|-----------|---------|
| 查看所有仓库 | ✅ | ✅(本部门) | ✅(本部门+密级≤) | ✅(本部门+密级≤) |
| 创建仓库 | ✅ | ✅ | ✅ | ❌ |
| 创建/删除分支 | ✅ | ✅ | ✅ | ❌ |
| 创建PR/合并 | ✅ | ✅ | ✅(仅创建) | ❌ |
| 创建版本 | ✅ | ✅ | ✅(仅创建) | ❌ |
| 创建/锁定/冻结基线 | ✅ | ✅ | ❌ | ❌ |
| 创建/恢复归档 | ✅ | ✅ | ❌ | ❌ |
| 审批操作 | ✅ | ✅(流程指定) | ❌ | ✅(流程指定) |
| 查看审计日志 | ✅ | ❌ | ❌ | ✅ |
| 用户/角色/部门管理 | ✅ | ❌ | ❌ | ❌ |
| 系统配置 | ✅ | ❌ | ❌ | ❌ |

---

## 2. 测试环境准备

### 2.1 前置条件

- Node.js 18+ 环境
- BFF 服务运行在 `http://localhost:8080`
- openGauss/PostgreSQL 数据库可连接
- Gitea 实例可连接（或使用 Mock 模式）
- 测试数据库已初始化（含默认角色、部门、审批流程、测试用户）

### 2.2 测试账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 系统管理员 | besti | huawei666 | 全部权限 |
| 项目管理员 | YuxiangLiu | huawei666 | 项目管理权限 |
| 开发人员 | lyx | huawei666 | 基本开发权限 |
| 审计人员 | xhy | huawei666 | 审计相关权限 |

### 2.3 测试数据库初始化

```bash
# 确保数据库中有默认数据
cd bff
node src/database/migrate.js
```

---

## 3. 测试用例索引

| ID | 模块 | 测试用例数 | 优先级 |
|----|------|-----------|--------|
| A | 用户认证与授权 | 12 | P0 |
| B | 仓库管理 | 10 | P0 |
| C | 分支管理 | 8 | P0 |
| D | 合并分支 | 8 | P0 |
| E | 版本管理 | 8 | P1 |
| F | 基线管理 | 8 | P1 |
| G | 归档管理 | 6 | P1 |
| H | 审批流程 | 12 | P0 |
| I | 审计日志 | 8 | P1 |
| J | 权限与越权 | 10 | P0 |
| K | 前端路由与页面 | 8 | P2 |
| **合计** | | **98** | |

---

## 4. 模块A：用户认证与授权

### A-01: 正常登录

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/auth/login` |
| **请求体** | `{"username":"besti","password":"huawei666"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"登录成功"`, data含token/user/permissions |
| **验证点** | 1. JWT token 非空且可解码<br>2. roleCode 为 "admin"<br>3. permissions 包含 "*"<br>4. 返回 nickname、departmentName<br>5. sessions 表中新增一条记录<br>6. user_profiles 表 last_login_time 已更新 |
| **关联代码** | [auth.js:17-287](bff/src/routes/auth.js#L17-L287) |

### A-02: 空用户名/密码

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/auth/login` |
| **请求体** | `{"username":"","password":""}` |
| **预期状态码** | 400 |
| **预期响应** | `code:400, message:"用户名和密码不能为空"` |
| **验证点** | auth.js:22-27 参数校验生效 |
| **关联代码** | [auth.js:22-27](bff/src/routes/auth.js#L22-L27) |

### A-03: 错误密码

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/auth/login` |
| **请求体** | `{"username":"besti","password":"wrongpassword"}` |
| **预期状态码** | 401 |
| **预期响应** | `code:401, message:"用户名或密码错误"` |
| **验证点** | 1. Gitea 认证失败<br>2. 本地密码哈希比对失败<br>3. 不生成 JWT |
| **关联代码** | [auth.js:92-97](bff/src/routes/auth.js#L92-L97) |

### A-04: 无 Token 访问受保护接口

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos` |
| **请求头** | 不带 Authorization |
| **预期状态码** | 401 |
| **预期响应** | `code:401, message:"未提供认证令牌"` |
| **验证点** | auth 中间件正确拦截无 token 请求 |
| **关联代码** | [auth.js:20-25](bff/src/middleware/auth.js#L20-L25) |

### A-05: 过期 Token

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos` |
| **请求头** | `Authorization: Bearer <过期JWT>` |
| **预期状态码** | 401 |
| **预期响应** | `code:401, message:"令牌已过期"` |
| **验证点** | auth.js:53-58 TokenExpiredError 处理 |
| **关联代码** | [auth.js:53-58](bff/src/middleware/auth.js#L53-L58) |

### A-06: 伪造 Token

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos` |
| **请求头** | `Authorization: Bearer invalid.token.here` |
| **预期状态码** | 401 |
| **预期响应** | `code:401, message:"无效的令牌"` |
| **验证点** | auth.js:59-63 jwt.verify 失败处理 |
| **关联代码** | [auth.js:59-63](bff/src/middleware/auth.js#L59-L63) |

### A-07: Token 来自 Query 参数

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos?token=<valid_token>` |
| **请求头** | 不带 Authorization |
| **预期状态码** | 200 |
| **验证点** | auth.js:16-18 支持从 query 参数获取 token（用于下载场景） |
| **风险** | Token 暴露在URL中，有日志泄露风险 |
| **关联代码** | [auth.js:16-18](bff/src/middleware/auth.js#L16-L18) |

### A-08: 正常登出

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/auth/logout` |
| **请求头** | `Authorization: Bearer <valid_token>` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"登出成功"` |
| **验证点** | 1. sessions 表对应用户记录已删除<br>2. credentialStore 中凭据已清除 |
| **关联代码** | [auth.js:290-299](bff/src/routes/auth.js#L290-L299) |

### A-09: 获取当前用户信息

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/auth/me` |
| **请求头** | `Authorization: Bearer <valid_token>` |
| **预期状态码** | 200 |
| **预期响应** | data含 id/username/nickname/role/departmentName/permissions |
| **验证点** | 1. 角色信息从数据库重读（非JWT）<br>2. 权限从roles表重读<br>3. 无token时返回401 |
| **关联代码** | [auth.js:302-361](bff/src/routes/auth.js#L302-L361) |

### A-10: 已注销/锁定用户拦截

| 项目 | 内容 |
|------|------|
| **前置操作** | 在 user_profiles 中将测试用户的 is_active 设为 false |
| **接口** | `GET /api/bff/repos` |
| **请求头** | 使用该用户的 token |
| **预期状态码** | 401 |
| **预期响应** | `message:"用户不存在或已注销"` |
| **关联代码** | [auth.js:34-36](bff/src/middleware/auth.js#L34-L36) |

### A-11: 账号锁定不能登录

| 项目 | 内容 |
|------|------|
| **前置操作** | 在 user_profiles 中将测试用户的 account_locked 设为 true |
| **接口** | `POST /api/bff/auth/login` |
| **预期状态码** | 403 |
| **预期响应** | `message:"账号已被锁定，请联系管理员"` |
| **关联代码** | [auth.js:109-114](bff/src/routes/auth.js#L109-L114) |

### A-12: 本地密码兜底认证

| 项目 | 内容 |
|------|------|
| **前置操作** | Gitea 服务不可用，但用户有本地 password_hash |
| **接口** | `POST /api/bff/auth/login` |
| **请求体** | `{"username":"besti","password":"huawei666"}` |
| **预期状态码** | 200 |
| **预期响应** | 登录成功，authSource 为 "local_fallback" |
| **验证点** | auth.js:40-88 本地密码兜底逻辑 |
| **关联代码** | [auth.js:40-88](bff/src/routes/auth.js#L40-L88) |

---

## 5. 模块B：仓库管理

### B-01: 管理员查看仓库列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos` |
| **角色** | admin |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total/page/pageSize，list中每项含 full_name/branches_count/_department_name/_secret_level |
| **验证点** | 1. 使用 Gitea admin API 获取全量仓库<br>2. 管理员可看到所有部门的仓库<br>3. 分支数通过 X-Total-Count 获取<br>4. repo_metadata 的部门/密级/显示名正确关联 |
| **关联代码** | [repos.js:48-240](bff/src/routes/repos.js#L48-L240) |

### B-02: 普通用户仓库列表（部门+密级过滤）

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos` |
| **角色** | developer（部门=技术部, secret_level=internal） |
| **预期状态码** | 200 |
| **验证点** | 1. 不显示其他部门的仓库<br>2. 不显示密级高于 internal 的仓库<br>3. 无部门信息的仓库适当放行 |
| **关联代码** | [repos.js:214-221](bff/src/routes/repos.js#L214-L221) |

### B-03: 仓库搜索

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos?search=test` |
| **角色** | admin |
| **预期状态码** | 200 |
| **预期响应** | list中仅包含 name/full_name/description 匹配 "test" 的仓库 |
| **验证点** | 搜索在BFF侧进行简单过滤（admin API可能不支持 q 参数） |
| **关联代码** | [repos.js:128-135](bff/src/routes/repos.js#L128-L135) |

### B-04: 仓库详情

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos/:owner/:repo` |
| **角色** | 任意已认证用户 |
| **预期状态码** | 200 |
| **预期响应** | data为Gitea仓库完整对象 |
| **验证点** | 代理到 Gitea API `/api/v1/repos/:owner/:repo` |
| **关联代码** | [repos.js:243-270](bff/src/routes/repos.js#L243-L270) |

### B-05: 不存在的仓库

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos/nonexistent/repo` |
| **预期状态码** | 500（抛异常进入 errorHandler） |
| **验证点** | Gitea 返回 404，BFF 抛出异常 |

### B-06: 仓库分支列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos/:owner/:repo/branches` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total |
| **关联代码** | [repos.js:273-304](bff/src/routes/repos.js#L273-L304) |

### B-07: 仓库提交历史

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repos/:owner/:repo/commits?sha=main` |
| **预期状态码** | 200 |
| **预期响应** | data含 list（提交记录数组） |
| **关联代码** | [repos.js:307-337](bff/src/routes/repos.js#L307-L337) |

### B-08: 批量获取文件最后提交信息

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/repos/:owner/:repo/last-commits` |
| **请求体** | `{"paths":["README.md","package.json"],"ref":"main"}` |
| **预期状态码** | 200 |
| **预期响应** | data为 `{path: {message, date, sha, author}}` 映射 |
| **验证点** | 并发批次控制（每次最多8个请求） |
| **关联代码** | [repos.js:342-395](bff/src/routes/repos.js#L342-L395) |

### B-09: 更新仓库元数据

| 项目 | 内容 |
|------|------|
| **接口** | `PUT /api/bff/repo-meta/:owner/:name` |
| **请求体** | `{"department_id":1,"secret_level":"internal","display_name":"测试仓库"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"元数据更新成功"` |
| **验证点** | 1. repo_metadata 表插入/更新正确<br>2. 不传字段时不覆盖已有值 |
| **关联代码** | [repoMeta.js:45-71](bff/src/routes/repoMeta.js#L45-L71) |

### B-10: 获取可见仓库列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/repo-meta/visible` |
| **角色** | developer |
| **预期状态码** | 200 |
| **预期响应** | data 仅含本部门+密级可见的仓库 |
| **关联代码** | [repoMeta.js:84-100](bff/src/routes/repoMeta.js#L84-L100) |

---

## 6. 模块C：分支管理

### C-01: 查看分支列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/branches/:owner/:repo/branches` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total |
| **关联代码** | [branches.js:19-50](bff/src/routes/branches.js#L19-L50) |

### C-02: 创建分支

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/branches/:owner/:repo/branches` |
| **请求体** | `{"new_branch_name":"feature/test","old_branch_name":"main"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"分支创建成功"`, data为分支对象 |
| **验证点** | 1. Gitea 分支创建成功<br>2. 兼容 new_branch/new_branch_name 和 old_branch/old_branch_name 参数名 |
| **关联代码** | [branches.js:53-89](bff/src/routes/branches.js#L53-L89) |

### C-03: 创建分支—缺少参数

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/branches/:owner/:repo/branches` |
| **请求体** | `{}` |
| **预期状态码** | 500（Gitea返回400错误） |
| **验证点** | Gitea API 校验缺失必填参数 |

### C-04: 删除分支

| 项目 | 内容 |
|------|------|
| **接口** | `DELETE /api/bff/branches/:owner/:repo/branches/:branch` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"分支删除成功"` |
| **关联代码** | [branches.js:92-118](bff/src/routes/branches.js#L92-L118) |

### C-05: 删除受保护分支

| 项目 | 内容 |
|------|------|
| **接口** | `DELETE /api/bff/branches/:owner/:repo/branches/main` |
| **预期状态码** | 500（Gitea返回403/422） |
| **验证点** | Gitea 保护分支机制生效 |

### C-06: 分支名含特殊字符

| 项目 | 内容 |
|------|------|
| **接口** | `DELETE /api/bff/branches/:owner/:repo/branches/feature%2Ftest` |
| **预期状态码** | 200 |
| **验证点** | encodeURIComponent 正确编码分支名中的 `/` |
| **关联代码** | [branches.js:97](bff/src/routes/branches.js#L97) |

### C-07: PR 列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/branches/:owner/:repo/pulls?state=open` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total |
| **关联代码** | [branches.js:121-151](bff/src/routes/branches.js#L121-L151) |

### C-08: PR 文件变更列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/branches/:owner/:repo/pulls/:index/files` |
| **预期状态码** | 200 |
| **预期响应** | data 为文件变更数组 |
| **关联代码** | [branches.js:223-250](bff/src/routes/branches.js#L223-L250) |

---

## 7. 模块D：合并分支

### D-01: 创建合并请求 (PR)

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/branches/:owner/:repo/pulls` |
| **请求体** | `{"title":"合并feature分支","description":"描述","head":"feature/test","base":"main"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"合并请求创建成功"`, data含PR编号 |
| **关联代码** | [branches.js:154-191](bff/src/routes/branches.js#L154-L191) |

### D-02: 合并 PR

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/branches/:owner/:repo/pulls/:index/merge` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"合并成功"` |
| **关联代码** | [branches.js:194-220](bff/src/routes/branches.js#L194-L220) |

### D-03: 合并有冲突的 PR

| 项目 | 内容 |
|------|------|
| **前置操作** | 创建两个修改同一文件同一行的分支并PR |
| **接口** | `POST /api/bff/branches/:owner/:repo/pulls/:index/merge` |
| **预期状态码** | 500（Gitea返回409） |
| **预期响应** | 错误信息 |

### D-04: 创建审批式合并请求

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/approvals` |
| **请求体** | `{"operationType":"merge","title":"合并分支X到Y","repoOwner":"owner","repoName":"repo","sourceBranch":"feature/x","targetBranch":"main","giteaPrNumber":1}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"审批申请已提交"`, data含approvalId |
| **验证点** | 1. 自动关联默认审批流程<br>2. status 为 "pending"<br>3. current_step 为 1 |
| **关联代码** | [approvals.js:377-427](bff/src/routes/approvals.js#L377-L427) |

### D-05: 审批通过后自动合并

| 项目 | 内容 |
|------|------|
| **前置操作** | 已有待审批的 merge 类型审批单（含 gitea_pr_number） |
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":"同意合并"}` |
| **预期状态码** | 200 |
| **验证点** | 1. 所有步骤审批通过<br>2. 后置操作调用 Gitea merge API<br>3. 审批状态变为 "approved" |
| **关联代码** | [approvals.js:628-652](bff/src/routes/approvals.js#L628-L652) |

### D-06: 获取合并请求列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approvals/merge-requests` |
| **预期状态码** | 200 |
| **预期响应** | data含 list，每项含 title/sourceBranch/targetBranch/approvalRate/approvals |
| **验证点** | 1. 仅返回 operation_type=merge 的记录<br>2. 部门密级过滤<br>3. approvalRate 计算正确 |
| **关联代码** | [approvals.js:218-302](bff/src/routes/approvals.js#L218-L302) |

### D-07: 审批被拒绝—不执行合并

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"rejected","body":"拒绝合并"}` |
| **预期状态码** | 200 |
| **预期响应** | `message:"审批已拒绝"` |
| **验证点** | 1. 审批状态变为 "rejected"<br>2. 不执行 Gitea merge<br>3. completed_at 被设置 |
| **关联代码** | [approvals.js:480-487](bff/src/routes/approvals.js#L480-L487) |

### D-08: 审批意见不能为空

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":""}` |
| **预期状态码** | 400 |
| **预期响应** | `message:"审批意见不能为空，请填写审批说明"` |
| **关联代码** | [approvals.js:440-445](bff/src/routes/approvals.js#L440-L445) |

---

## 8. 模块E：版本管理

### E-01: 获取版本列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/versions` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total（从 approvals 表查 operation_type=version） |
| **关联代码** | [versions.js:11-46](bff/src/routes/versions.js#L11-L46) |

### E-02: 创建版本（提交审批）

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/versions` |
| **请求体** | `{"repoOwner":"owner","repoName":"repo","tagName":"v1.0.0","message":"首次发布","targetBranch":"main"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"版本创建申请已提交，等待审批"` |
| **验证点** | approvals 表插入 operation_type=version 的记录 |
| **关联代码** | [versions.js:81-109](bff/src/routes/versions.js#L81-L109) |

### E-03: 获取版本详情

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/versions/v1.0.0?repoOwner=owner&repoName=repo` |
| **预期状态码** | 200 |
| **预期响应** | data为版本审批记录 |
| **关联代码** | [versions.js:49-78](bff/src/routes/versions.js#L49-L78) |

### E-04: 不存在的版本

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/versions/v99.99.99?repoOwner=owner&repoName=repo` |
| **预期状态码** | 404 |
| **预期响应** | `code:404, message:"版本不存在"` |

### E-05: 版本发布审批通过后创建 Tag

| 项目 | 内容 |
|------|------|
| **前置操作** | 创建 version_release 类型审批单（description中含BODY参数） |
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":"同意发布"}` |
| **预期状态码** | 200 |
| **验证点** | 1. 调用 Gitea API 创建 tag<br>2. 调用 Gitea API 创建 release<br>3. executePostApprovalAction 正确执行 |
| **关联代码** | [approvals.js:543-576](bff/src/routes/approvals.js#L543-L576) |

### E-06: 标记为基线版本

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/versions/:tagName/baseline` |
| **请求体** | `{"repoOwner":"owner","repoName":"repo","description":"稳定基线"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"已标记为基线版本"` |
| **验证点** | baselines 表插入记录，status=active, lock_status=locked |
| **关联代码** | [versions.js:112-141](bff/src/routes/versions.js#L112-L141) |

### E-07: 过滤版本列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/versions?repoOwner=owner&repoName=repo&status=approved` |
| **预期状态码** | 200 |
| **预期响应** | list 仅含指定仓库和状态的版本 |

### E-08: 分页查询版本

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/versions?page=1&pageSize=5` |
| **预期状态码** | 200 |
| **预期响应** | page=1, pageSize=5, total 正确，list 不超5条 |

---

## 9. 模块F：基线管理

### F-01: 获取基线列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/baselines` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total，每项含 name/version/repoName/displayName/creator/createdAt |
| **验证点** | 1. 部门密级过滤<br>2. 批量获取仓库显示名<br>3. 创建者用户名映射 |
| **关联代码** | [baselines.js:32-122](bff/src/routes/baselines.js#L32-L122) |

### F-02: 创建基线（提交审批）

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/baselines` |
| **请求体** | `{"name":"基线v1.0","versionName":"v1.0.0","repoOwner":"owner","repoName":"repo","sha":"abc123","description":"稳定版本基线"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"基线创建申请已提交，等待审批"`, data含approvalId |
| **验证点** | 1. approvals 表插入 operation_type=baseline_create<br>2. 自动关联默认审批流程<br>3. description中含 `<!--BODY ... BODY-->` 参数 |
| **关联代码** | [baselines.js:144-193](bff/src/routes/baselines.js#L144-L193) |

### F-03: 重复基线创建拦截

| 项目 | 内容 |
|------|------|
| **前置操作** | 该仓库已有活跃基线 |
| **接口** | `POST /api/bff/baselines` |
| **预期状态码** | 400 |
| **预期响应** | `message:"该仓库已存在活跃基线，只能变更基线不能重复创建"` |
| **关联代码** | [baselines.js:149-154](bff/src/routes/baselines.js#L149-L154) |

### F-04: 待审批重复拦截

| 项目 | 内容 |
|------|------|
| **前置操作** | 该仓库已有 pending 状态的 baseline_create 审批 |
| **接口** | `POST /api/bff/baselines` |
| **预期状态码** | 400 |
| **预期响应** | `message:"该仓库已有待审批的基线创建申请"` |
| **关联代码** | [baselines.js:157-162](bff/src/routes/baselines.js#L157-L162) |

### F-05: 锁定/解锁基线

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/baselines/:id/lock` |
| **请求体** | `{"locked":true}` |
| **预期状态码** | 200 |
| **预期响应** | `message:"基线已锁定"` |
| **验证点** | baselines 表 is_locked/ locked_by/ locked_at 正确更新 |
| **关联代码** | [baselines.js:232-252](bff/src/routes/baselines.js#L232-L252) |

### F-06: 冻结基线

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/baselines/:id/freeze` |
| **预期状态码** | 200 |
| **预期响应** | `message:"基线已冻结"` |
| **验证点** | 1. status 变为 "frozen"<br>2. is_locked 强制设为 true |
| **关联代码** | [baselines.js:255-274](bff/src/routes/baselines.js#L255-L274) |

### F-07: 检查标签是否为基线

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/baselines/check?tags=owner/repo@v1.0.0,owner/repo@v2.0.0` |
| **预期状态码** | 200 |
| **预期响应** | data为 `{"owner/repo@v1.0.0":true, "owner/repo@v2.0.0":false}` |
| **关联代码** | [baselines.js:13-29](bff/src/routes/baselines.js#L13-L29) |

### F-08: 基线详情

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/baselines/:id` |
| **预期状态码** | 200 |
| **预期响应** | data 为基线完整记录 |
| **不存在的ID** | 返回 404 |

---

## 10. 模块G：归档管理

### G-01: 获取归档列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/archives` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total |
| **验证点** | 部门密级过滤 |
| **关联代码** | [archives.js:12-64](bff/src/routes/archives.js#L12-L64) |

### G-02: 创建归档

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/archives` |
| **请求体** | `{"repoOwner":"owner","repoName":"repo","tagName":"v1.0.0","archiveType":"full","reason":"版本过期"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"归档成功"` |
| **验证点** | archives 表插入记录，status=archived |
| **关联代码** | [archives.js:67-86](bff/src/routes/archives.js#L67-L86) |

### G-03: 恢复归档

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/archives/:id/restore` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"恢复成功"` |
| **验证点** | archives 表 status 更新为 "active" |
| **关联代码** | [archives.js:89-101](bff/src/routes/archives.js#L89-L101) |

### G-04: 按类型过滤归档

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/archives?archiveType=full` |
| **预期状态码** | 200 |
| **预期响应** | list 仅含 archive_type=full 的记录 |

### G-05: 基线归档审批通过后处理

| 项目 | 内容 |
|------|------|
| **前置操作** | 创建 baseline_archive 类型审批单 |
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":"同意归档"}` |
| **验证点** | 1. baselines 表 status→archived<br>2. archives 表插入记录<br>3. Gitea 仓库设为 archived=true |
| **关联代码** | [approvals.js:579-599](bff/src/routes/approvals.js#L579-L599) |

### G-06: 分页查询归档

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/archives?page=1&pageSize=10` |
| **预期状态码** | 200 |
| **预期响应** | page=1, pageSize=10, total正确 |

---

## 11. 模块H：审批流程

### H-01: 获取审批列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approvals` |
| **角色** | admin |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total |
| **关联代码** | [approvals.js:64-100](bff/src/routes/approvals.js#L64-L100) |

### H-02: 获取待我审批列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approvals/pending` |
| **角色** | project_manager |
| **预期状态码** | 200 |
| **验证点** | 1. 仅返回 status=pending 的审批<br>2. 仅返回当前步骤匹配用户角色的审批<br>3. 部门密级过滤 |
| **关联代码** | [approvals.js:114-186](bff/src/routes/approvals.js#L114-L186) |

### H-03: 创建审批申请

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/approvals` |
| **请求体** | `{"operationType":"merge","title":"合并请求","description":"合并开发分支","repoOwner":"owner","repoName":"repo","sourceBranch":"dev","targetBranch":"main","urgency":"high","secretLevel":"internal"}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"审批申请已提交"`, data含approvalId/approvalFlowId |
| **验证点** | 1. 不指定流程时自动使用默认流程<br>2. status=pending, current_step=1 |
| **关联代码** | [approvals.js:377-427](bff/src/routes/approvals.js#L377-L427) |

### H-04: 处理审批—多步流程第1步通过

| 项目 | 内容 |
|------|------|
| **前置操作** | 使用二级审批流程（步骤：技术负责人审核→项目经理审批），当前在第1步 |
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":"技术审核通过"}` |
| **预期状态码** | 200 |
| **预期响应** | `message:"审批已通过（第 1 步），等待第 2 步审批"`, data含nextStep/totalSteps |
| **验证点** | 1. status 保持 "pending"<br>2. current_step 变为 2<br>3. approval_records 表插入第1步记录 |
| **关联代码** | [approvals.js:491-504](bff/src/routes/approvals.js#L491-L504) |

### H-05: 处理审批—最后一步通过

| 项目 | 内容 |
|------|------|
| **前置操作** | 审批在最后一步 |
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":"最终通过"}` |
| **预期状态码** | 200 |
| **预期响应** | `message:"审批全部通过，操作已执行"` |
| **验证点** | 1. status 变为 "approved"<br>2. completed_at 被设置<br>3. 后置操作 executePostApprovalAction 被调用 |
| **关联代码** | [approvals.js:506-527](bff/src/routes/approvals.js#L506-L527) |

### H-06: 重复审批拦截

| 项目 | 内容 |
|------|------|
| **前置操作** | 审批单 status 不是 "pending"（已通过或已拒绝） |
| **接口** | `POST /api/bff/approvals/:id/process` |
| **请求体** | `{"action":"approved","body":"再次审批"}` |
| **预期状态码** | 400 |
| **预期响应** | `message包含"该审批已处理，当前状态"` |
| **关联代码** | [approvals.js:453-458](bff/src/routes/approvals.js#L453-L458) |

### H-07: 审批统计

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approvals/stats/summary` |
| **预期状态码** | 200 |
| **预期响应** | data含 pending/approved/rejected/total 数量 |
| **关联代码** | [approvals.js:305-328](bff/src/routes/approvals.js#L305-L328) |

### H-08: 审批流程模板列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approval-flows` |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total，每项含 name/code/steps/applicableSecretLevels |
| **关联代码** | [approvalFlows.js:16-64](bff/src/routes/approvalFlows.js#L16-L64) |

### H-09: 创建审批流程模板

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/approval-flows` |
| **请求体** | `{"name":"测试流程","code":"test_flow","description":"测试用","steps":["步骤1","步骤2"],"isDefault":false}` |
| **预期状态码** | 200 |
| **预期响应** | `code:200, message:"审批流程模板创建成功"` |
| **验证点** | 1. flow_id 自增<br>2. is_active 默认为 true<br>3. 重复 code 返回 400 |
| **关联代码** | [approvalFlows.js:103-139](bff/src/routes/approvalFlows.js#L103-L139) |

### H-10: 建议审批流程

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approval-flows/suggest/list?secretLevel=secret&operationType=merge` |
| **预期状态码** | 200 |
| **预期响应** | data 只返回匹配密级和操作类型的流程 |
| **关联代码** | [approvalFlows.js:199-228](bff/src/routes/approvalFlows.js#L199-L228) |

### H-11: 删除审批流程（有进行中的审批单）

| 项目 | 内容 |
|------|------|
| **前置操作** | 该流程被某个 pending 审批单使用 |
| **接口** | `DELETE /api/bff/approval-flows/:flowId` |
| **预期状态码** | 400 |
| **预期响应** | `message:"该流程存在待处理的审批单，无法删除"` |
| **关联代码** | [approvalFlows.js:178-194](bff/src/routes/approvalFlows.js#L178-L194) |

### H-12: 获取审批详情（含审批记录）

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approvals/:id` |
| **预期状态码** | 200 |
| **预期响应** | data含 steps/totalSteps/approval_records（含审批人名称） |
| **关联代码** | [approvals.js:333-374](bff/src/routes/approvals.js#L333-L374) |

---

## 12. 模块I：审计日志

### I-01: 获取审计日志列表

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/audit/logs` |
| **角色** | auditor（需 audit:view 权限） |
| **预期状态码** | 200 |
| **预期响应** | data含 list/total/page/pageSize |
| **验证点** | 1. 每条含 log_id/timestamp/username/action_type/request_path<br>2. requirePermission('audit:view') 中间件生效 |
| **关联代码** | [audit.js:11-54](bff/src/routes/audit.js#L11-L54) |

### I-02: 审计日志过滤

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/audit/logs?username=besti&actionType=login&startDate=2026-01-01&endDate=2026-12-31` |
| **预期状态码** | 200 |
| **预期响应** | list 仅含匹配条件的日志 |

### I-03: 审计日志详情

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/audit/logs/:id` |
| **预期状态码** | 200 |
| **预期响应** | data 含完整日志信息（含 request_body/response_status 等） |

### I-04: 不存在日志详情

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/audit/logs/nonexistent` |
| **预期状态码** | 404 |

### I-05: 验证审计日志链完整性

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/audit/logs/verify-integrity` |
| **请求体** | `{"startLogId":"AUDIT-xxx","endLogId":"AUDIT-yyy"}` |
| **预期状态码** | 200 |
| **预期响应** | data含 isValid/totalLogs/invalidLogs |
| **验证点** | 哈希链验证逻辑，prev_hash 不匹配的日志被检测到 |
| **关联代码** | [audit.js:77-108](bff/src/routes/audit.js#L77-L108) |

### I-06: 操作统计

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/audit/stats/operations` |
| **预期状态码** | 200 |
| **预期响应** | data含 totalOperations/totalUsers/totalRepos/riskCount |

### I-07: 导出审计日志 CSV

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/audit/export` |
| **预期状态码** | 200 |
| **预期响应** | Content-Type: text/csv, BOM头, UTF-8中文 |
| **验证点** | 1. CSV 格式正确（含BOM）<br>2. 特殊字符转义<br>3. 最大10000条限制 |
| **关联代码** | [audit.js:152-201](bff/src/routes/audit.js#L152-L201) |

### I-08: 审计中间件记录请求

| 项目 | 内容 |
|------|------|
| **操作** | 发起任意 API 请求（含 Authorization） |
| **验证点** | 1. audit_logs 表新增一条记录<br>2. integrity_hash 非空<br>3. prev_hash 指向上一条<br>4. request_body 被记录（不含过长内容）<br>5. action_type 根据路径正确推断 |
| **关联代码** | [audit.js:73-142](bff/src/middleware/audit.js#L73-L142) |

---

## 13. 模块J：权限与越权测试

### J-01: 审计人员访问非审计页面

| 项目 | 内容 |
|------|------|
| **操作** | 审计人员 token 访问 `GET /api/bff/repos` |
| **预期状态码** | 200（repos 路由未做角色限制，仅需认证） |
| **说明** | 仓库查看权限通过部门密级过滤实现，而非角色限制 |

### J-02: 审计人员访问审计页面

| 项目 | 内容 |
|------|------|
| **操作** | 审计人员 token 访问 `GET /api/bff/audit/logs` |
| **预期状态码** | 200 |
| **权限检查** | requirePermission('audit:view') |

### J-03: 开发人员访问管理接口

| 项目 | 内容 |
|------|------|
| **操作** | 开发人员 token 访问 `GET /api/bff/users` |
| **预期状态码** | 403（需要 admin:manage 权限） |
| **验证点** | requirePermission 中间件正确拦截 |

### J-04: 普通用户尝试越权修改角色

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/roles` |
| **角色** | developer |
| **预期状态码** | 403（只有admin可以） |

### J-05: 修改其他用户信息（IDOR）

| 项目 | 内容 |
|------|------|
| **接口** | `PUT /api/bff/users/:id` |
| **角色** | developer（非admin） |
| **请求体** | `{"role_code":"admin"}` |
| **预期结果** | 应阻止非admin修改用户信息 |
| **已知风险** | [BUG报告 C-01] users.js PUT /:id 缺失 requireAdmin |

### J-06: 无认证访问审批流程接口

| 项目 | 内容 |
|------|------|
| **接口** | `GET /api/bff/approval-flows` |
| **请求头** | 不带 Authorization |
| **预期状态码** | 401 |
| **验证点** | approveFlowRoutes 各路由的 authenticate 中间件 |

### J-07: 系统配置修改越权

| 项目 | 内容 |
|------|------|
| **接口** | `PUT /api/bff/system/config` |
| **角色** | developer |
| **预期结果** | 应阻止非admin修改系统配置 |
| **已知风险** | [BUG报告 C-05] system.js PUT /config 缺失 requireAdmin |

### J-08: 基线冻结越权

| 项目 | 内容 |
|------|------|
| **接口** | `POST /api/bff/baselines/:id/freeze` |
| **角色** | developer |
| **预期状态码** | 403 |
| **验证点** | baselines.js 仅 authenticate（未 requireAdmin/requireRole），需检查是否有限制 |

### J-09: 管理员万能权限验证

| 项目 | 内容 |
|------|------|
| **操作** | admin 角色访问任意接口 |
| **预期结果** | 1. requirePermission 中 permissions.includes('*') 直接放行<br>2. requireRole 中 roleCode==='admin' 直接放行 |
| **关联代码** | [auth.js:76-78](bff/src/middleware/auth.js#L76-L78) |

### J-10: 部门隔离验证

| 项目 | 内容 |
|------|------|
| **操作** | 技术部用户查看审批列表 |
| **预期结果** | 仅能看到申请人属于技术部的审批单 |
| **关联代码** | [approvals.js:16-33](bff/src/routes/approvals.js#L16-L33) |

---

## 14. 模块K：前端路由与页面测试

### K-01: 路由守卫—未登录跳转

| 项目 | 内容 |
|------|------|
| **操作** | 未登录直接访问 `/dashboard` |
| **预期结果** | 自动跳转到 `/login` |
| **关联代码** | [router/index.js:153-162](front/src/router/index.js#L153-L162) |

### K-02: 路由守卫—权限不足

| 项目 | 内容 |
|------|------|
| **操作** | developer 角色访问 `/admin/users` |
| **预期结果** | ElMessage.error + 跳转到 `/dashboard` |
| **关联代码** | [router/index.js:170-174](front/src/router/index.js#L170-L174) |

### K-03: 审计人员路由限制

| 项目 | 内容 |
|------|------|
| **操作** | auditor 角色访问 `/repos` |
| **预期结果** | ElMessage.warning + 跳转到 `/dashboard` |
| **验证点** | 仅允许 /dashboard /profile /settings /audit/* 页面 |
| **关联代码** | [router/index.js:177-188](front/src/router/index.js#L177-L188) |

### K-04: 登录页自动跳转

| 项目 | 内容 |
|------|------|
| **操作** | 已登录用户访问 `/login` |
| **预期结果** | 重定向到 `/dashboard` |

### K-05: Pinia Store Token 持久化

| 项目 | 内容 |
|------|------|
| **操作** | 登录后刷新页面 |
| **验证点** | 1. token 从 sessionStorage 恢复<br>2. userStore.initUser() 重新获取用户信息<br>3. 路由守卫正确识别已认证状态 |
| **关联代码** | [user.js:10-11](front/src/stores/user.js#L10-L11), [api/index.js:12](front/src/api/index.js#L12) |

### K-06: Axios 401 自动跳转

| 项目 | 内容 |
|------|------|
| **操作** | 使用过期 token 发起 API 请求 |
| **预期结果** | 响应拦截器捕获 401 → 清除 token → 跳转登录页 |
| **关联代码** | [api/index.js:23-34](front/src/api/index.js#L23-L34) |

### K-07: 侧边栏权限隐藏

| 项目 | 内容 |
|------|------|
| **操作** | 不同角色登录后查看侧边栏菜单 |
| **验证点** | 1. 非admin看不到"系统管理"子菜单<br>2. "备份管理"菜单项已被注释隐藏<br>3. auditor 只能看到审计和工作台菜单 |
| **关联代码** | [App.vue:118](front/src/App.vue#L118) |

### K-08: 仓库详情页 XSS 防护

| 项目 | 内容 |
|------|------|
| **操作** | Gitea release body 含 `<img src=x onerror=alert(1)>` |
| **验证点** | v-html 渲染的 Release body 是否被 DOMPurify 处理 |
| **已知风险** | [BUG报告 C-03] 直接使用 v-html 未经净化 |

---

## 15. 自动化测试脚本使用指南

### 15.1 目录结构

```
tests/
├── package.json          # 测试依赖配置
├── config.js             # 测试配置（BASE_URL, 账号等）
├── helpers/
│   └── api.js            # 测试辅助函数（登录、请求封装）
├── auth.test.js          # 认证模块测试 (A-01 ~ A-12)
├── repos.test.js         # 仓库模块测试 (B-01 ~ B-10)
├── branches.test.js      # 分支模块测试 (C-01 ~ C-08)
├── merge.test.js         # 合并模块测试 (D-01 ~ D-08)
├── versions.test.js      # 版本模块测试 (E-01 ~ E-08)
├── baselines.test.js     # 基线模块测试 (F-01 ~ F-08)
├── archives.test.js      # 归档模块测试 (G-01 ~ G-06)
├── approvals.test.js     # 审批流程测试 (H-01 ~ H-12)
├── audit.test.js         # 审计日志测试 (I-01 ~ I-08)
├── security.test.js      # 权限越权测试 (J-01 ~ J-10)
└── run-all.js            # 全量测试执行器
```

### 15.2 测试工具选择

- **测试框架**: Mocha / 或直接使用 Node.js 内置 test runner (Node 18+)
- **HTTP 客户端**: 原生 fetch (Node 18+ 内置)
- **断言**: Node.js 内置 `assert` 模块

### 15.3 安装与运行

```bash
# 进入测试目录
cd tests

# 安装依赖（如果使用 mocha 方案）
npm install

# 运行全部测试
node run-all.js

# 运行单个模块测试
node auth.test.js
node repos.test.js
node branches.test.js
node merge.test.js
node versions.test.js
node baselines.test.js
node archives.test.js
node approvals.test.js
node audit.test.js
node security.test.js

# 运行全量测试（Mocha 方案）
npx mocha "*.test.js" --timeout 30000 --reporter spec
```
