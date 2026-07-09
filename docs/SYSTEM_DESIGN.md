# 党政软件版本管控平台 — 系统设计文档

> **架构**: Vue 3 前端 → Node.js BFF 层 → Gitea API + openGauss + Redis
> **版本**: v2.1
> **日期**: 2026-07-09

---

## 目录

1. [总体架构](#1-总体架构)
2. [需求实现矩阵](#2-需求实现矩阵)
3. [前端直接实现（Gitea API）](#3-前端直接实现gitea-api)
4. [BFF 层详细设计](#4-bff-层详细设计)
   - [4.1 版本编号引擎](#41-版本编号引擎)
   - [4.2 审批流程引擎](#42-审批流程引擎)
   - [4.3 基线归档管理](#43-基线归档管理)
   - [4.4 版本废弃管理](#44-版本废弃管理)
   - [4.5 权限与身份管控](#45-权限与身份管控)
   - [4.6 审计日志系统](#46-审计日志系统)
   - [4.7 合规审计报表](#47-合规审计报表)
   - [4.8 安全与备份管理](#48-安全与备份管理)
   - [4.9 风险监控预警](#49-风险监控预警)
   - [4.10 通知系统](#410-通知系统)
   - [4.11 系统配置管理](#411-系统配置管理)
   - [4.12 统计看板](#412-统计看板)
5. [数据库设计](#5-数据库设计)
6. [BFF 层技术方案](#6-bff-层技术方案)

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────┐
│                    浏览器 (Vue 3)                      │
│   Element Plus + ECharts + Axios + Pinia             │
└────────────┬───────────────────────┬────────────────┘
             │                       │
    ┌────────▼────────┐    ┌────────▼──────────────┐
    │   Gitea API      │    │   Node.js BFF 层       │
    │   (直接调用)      │    │   (Express/Koa/Fastify) │
    │                  │    │                        │
    │ • 仓库 CRUD       │    │ • 审批流程引擎          │
    │ • 分支管理        │    │ • 版本编号规则引擎       │
    │ • Tag/Release    │    │ • 基线归档管理          │
    │ • 提交历史/差异   │    │ • 权限 RBAC 系统        │
    │ • PR/Merge       │    │ • 审计日志系统          │
    │ • 文件浏览        │    │ • 报表生成引擎          │
    │ • 用户 Token      │    │ • 风险监控预警          │
    └─────────────────┘    │ • 备份调度管理          │
                           │ • 通知推送服务          │
                           └───────────┬────────────┘
                                       │
                           ┌───────────▼────────────┐
                           │   openGauss 数据库       │
                           │   (PostgreSQL 兼容)      │
                           │   + Redis 缓存/会话      │
                           │   + 文件存储 (MinIO)     │
                           └────────────────────────┘
```

**职责划分原则：**
- **前端 → Gitea API**：Git 原生操作（仓库、分支、Tag、PR、提交、文件）
- **前端 → Node.js BFF → 数据库**：所有业务逻辑（审批、权限、审计、基线、归档、报表、风险监控）
- **BFF 层**：聚合 Gitea API + 业务数据库，为前端提供统一接口

---

## 2. 需求实现矩阵

| 编号 | 需求 | 实现方式 | 说明 |
|:---:|------|:---:|------|
| FR-001 | 标准化版本编号管理 | 🟡 BFF + 前端 | Gitea Tag + BFF 编号规则引擎 |
| FR-002 | 多源制品出入库 | 🟢 前端 + Gitea | Git LFS、文件上传 API |
| FR-003 | 版本迭代与差异对比 | 🟢 前端 + Gitea | Gitea compare/diff API |
| FR-004 | 版本归档与基线封存 | 🔴 BFF | 基线状态机 + 审批联动 |
| FR-005 | 版本查询与预览 | 🟢 前端 + Gitea | Gitea tags/contents API + BFF 扩展检索 |
| FR-006 | 版本废弃管理 | 🔴 BFF | 废弃状态机 + 审批流程 |
| FR-007 | 多分支隔离管控 | 🟢 前端 + Gitea | Gitea branches + protection |
| FR-008 | 审批制分支合并 | 🟡 BFF + Gitea | BFF 审批 + Gitea PR merge |
| FR-009 | 分支状态可视化监控 | 🟢 前端 + Gitea | Gitea branches API + ECharts |
| FR-010 | 紧急版本修复机制 | 🟡 BFF + Gitea | Hotfix 分支 + 快速审批通道 |
| FR-011 | 分级审批策略配置 | 🔴 BFF | 审批流程模板 CRUD |
| FR-012 | 全场景变更审批 | 🔴 BFF | 审批前置拦截器模式 |
| FR-013 | 上线合规审批管控 | 🔴 BFF | 合规检查清单 + 审批 |
| FR-014 | 审批轨迹全程留存 | 🔴 BFF | 审计表关联审批记录 |
| FR-015 | 多角色权责分级 | 🔴 BFF | RBAC 系统 |
| FR-016 | 细粒度权限管控 | 🔴 BFF | 27 项权限独立控制 |
| FR-017 | 部门数据隔离 | 🔴 BFF | 部门级数据过滤中间件 |
| FR-018 | 高强度身份鉴权 | 🟡 BFF + Gitea | Gitea 认证 + BFF MFA/预警 |
| FR-019 | 静默伴生全量日志 | 🔴 BFF | 独立审计日志表 + 中间件 |
| FR-020 | 日志防篡改永久留存 | 🔴 BFF | SHA-256 链式校验 + 只读存储 |
| FR-021 | 多维度审计检索 | 🔴 BFF | ES 或 PG 全文检索 |
| FR-022 | 合规审计报表导出 | 🔴 BFF | PDF/Excel 生成引擎 |
| FR-023 | 全程加密存储 | 🔴 BFF + Infra | AES-256 + 传输 TLS |
| FR-024 | 高可靠自动备份恢复 | 🔴 BFF + Infra | mariabackup + mysqldump 调度 + MinIO |
| FR-025 | 文件防篡改校验 | 🔴 BFF | 文件指纹定期校验任务 |
| FR-026 | 涉密数据防泄漏管控 | 🔴 BFF | 下载拦截 + 水印 + 限制 |
| FR-027 | 全场景国产化适配 | 🟡 Infra | 麒麟/鲲鹏部署方案 |
| FR-028 | 系统风险监控预警 | 🔴 BFF | 异常检测规则引擎 |
| FR-029 | 国产化友好交互界面 | 🟢 前端 | UI/UX 设计 |

> 🟢 = 前端直接实现 &nbsp; 🟡 = 前端 + BFF 混合 &nbsp; 🔴 = 纯 BFF 实现

---

## 3. 前端直接实现（Gitea API）

以下功能前端已通过 Gitea REST API 实现：

### 3.1 仓库 CRUD（FR-002 部分）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| 仓库列表 | `GET /user/repos` | [repos/index.vue](../src/views/repos/index.vue) |
| 创建仓库 | `POST /user/repos` | [repos/create.vue](../src/views/repos/create.vue) |
| 仓库详情 | `GET /repos/{owner}/{repo}` | [repos/detail.vue](../src/views/repos/detail.vue) |
| 删除仓库 | `DELETE /repos/{owner}/{repo}` | [repos/index.vue](../src/views/repos/index.vue) |
| 克隆地址 | `clone_url` / `ssh_url` 字段 | 克隆弹窗 |

### 3.2 分支管理（FR-007）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| 分支列表 | `GET /repos/{owner}/{repo}/branches` | [repos/detail.vue](../src/views/repos/detail.vue) |
| 创建分支 | `POST /repos/{owner}/{repo}/branches` | 创建分支弹窗 |
| 删除分支 | `DELETE /repos/{owner}/{repo}/branches/{branch}` | 删除确认 |
| 全局分支概览 | 遍历所有仓库 branches | [branches/index.vue](../src/views/branches/index.vue) |

### 3.3 版本/Tag 管理（FR-001 部分）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| Tag 列表 | `GET /repos/{owner}/{repo}/tags` | [repos/detail.vue](../src/views/repos/detail.vue) |
| 创建 Tag | `POST /repos/{owner}/{repo}/tags` | 创建 Tag 弹窗 |
| 全局版本概览 | 遍历所有仓库 tags | [versions/index.vue](../src/views/versions/index.vue) |
| 版本下载 | `/archive/{tag}.tar.gz` | 下载按钮 |

### 3.4 提交历史与差异对比（FR-003）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| 提交历史 | `GET /repos/{owner}/{repo}/commits` | 提交列表 |
| 提交详情 | `GET /repos/{owner}/{repo}/commits/{sha}` | 提交详情 |
| 差异对比 | `GET /repos/{owner}/{repo}/compare/{base}...{head}` | 差异对比弹窗 |

### 3.5 合并请求（FR-008 部分）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| PR 列表 | `GET /repos/{owner}/{repo}/pulls` | [branches/merge.vue](../src/views/branches/merge.vue) |
| 创建 PR | `POST /repos/{owner}/{repo}/pulls` | 创建 PR 弹窗 |
| PR 详情 | `GET /repos/{owner}/{repo}/pulls/{number}` | PR 详情弹窗 |
| 合并 PR | `POST /repos/{owner}/{repo}/pulls/{number}/merge` | 合并按钮 |
| 关闭 PR | `PATCH /repos/{owner}/{repo}/pulls/{number}` | 关闭按钮 |

### 3.6 文件浏览（FR-005 部分）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| 目录浏览 | `GET /repos/{owner}/{repo}/contents/{path}` | 文件树 |
| Git 树 | `GET /repos/{owner}/{repo}/git/trees/{sha}` | 文件树递归 |

### 3.7 用户认证与基础管理（FR-018 部分）

| 功能 | Gitea API | 前端页面 |
|------|-----------|----------|
| 身份验证 | Basic Auth → Token | [stores/user.js](../src/stores/user.js) |
| 当前用户 | `GET /user` | 用户信息显示 |
| 管理员用户列表 | `GET /admin/users` | [admin/users.vue](../src/views/admin/users.vue) |
| 创建用户 | `POST /admin/users` | 新建用户弹窗 |
| 编辑用户 | `PATCH /admin/users/{username}` | 编辑用户弹窗 |
| 删除用户 | `DELETE /admin/users/{username}` | 删除确认 |

---

## 4. BFF 层详细设计

### 4.1 版本编号引擎

**对应需求**: FR-001 标准化版本编号管理

**功能描述**: 在 Gitea Tag 基础上提供党政专用版本编号规则引擎，支持版本号自动生成、格式校验、规范修正。

#### 4.1.1 版本号规则配置

| 项目 | 值 |
|------|-----|
| **接口名称** | Update Version Numbering Rules |
| **中文名称** | 配置版本编号规则 |
| **路径** | `PUT /api/bff/version-rules` |
| **权限** | `admin:manage` |

**请求体:**

```json
{
  "defaultPattern": "MAJOR.MINOR.PATCH",
  "patterns": [
    {
      "name": "标准语义化版本",
      "pattern": "^v?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$",
      "example": "v1.2.3",
      "description": "主版本号.次版本号.修订号，可选 v 前缀"
    },
    {
      "name": "党政专用版本",
      "pattern": "^V(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)-(release|beta|rc)\\d*$",
      "example": "V2.0.1-release",
      "description": "带发布阶段的党政版本号"
    }
  ],
  "autoIncrementRules": {
    "major": "重大功能迭代、架构升级、不兼容变更",
    "minor": "普通功能新增、性能优化、非破坏性变更",
    "patch": "Bug修复、文档更新、细节微调"
  },
  "prohibitPatterns": [
    "禁止使用日期作为版本号",
    "禁止使用纯数字无分隔符",
    "禁止使用中文或特殊字符"
  ],
  "enforceOnTagCreation": true
}
```

**返回数据:**

```json
{
  "code": 200,
  "message": "版本编号规则已更新",
  "data": {
    "version": 2,
    "updatedAt": "2026-07-08T10:00:00Z"
  }
}
```

#### 4.1.2 获取版本编号规则

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/version-rules` |

**返回数据:** 同上请求体结构

#### 4.1.3 版本号校验与建议

| 项目 | 值 |
|------|-----|
| **接口名称** | Validate & Suggest Version |
| **中文名称** | 校验版本号并生成建议 |
| **路径** | `POST /api/bff/version-rules/validate` |

**请求体:**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "proposedVersion": "v2.0.0",
  "changeType": "minor",
  "lastVersion": "v1.5.3"
}
```

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "valid": true,
    "normalized": "v2.0.0",
    "suggestedVersion": "v1.6.0",
    "warnings": [
      "建议次版本号从 v1.5.3 → v1.6.0，而非 v2.0.0（主版本号升级仅用于重大功能迭代）"
    ],
    "ruleMatched": "标准语义化版本"
  }
}
```

#### 4.1.4 自动生成下一版本号

| 项目 | 值 |
|------|-----|
| **接口名称** | Auto-generate Next Version |
| **中文名称** | 自动生成下一版本号 |
| **路径** | `GET /api/bff/version-rules/next-version` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `repoOwner` | string | 是 | 仓库所有者 |
| `repoName` | string | 是 | 仓库名称 |
| `changeType` | string | 是 | `major` / `minor` / `patch` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "currentVersion": "v1.5.3",
    "nextVersion": "v1.6.0",
    "changeType": "minor",
    "changeDescription": "普通功能新增（次版本号升级）"
  }
}
```

---

### 4.2 审批流程引擎

**对应需求**: FR-008, FR-011, FR-012, FR-013, FR-014

**功能描述**: 提供完整的审批流程管理，支持分级审批策略配置、全场景变更审批、上线合规审批、审批轨迹留存。

#### 4.2.1 审批流程模板管理

##### 4.2.1.1 获取审批流程模板列表

| 项目 | 值 |
|------|-----|
| **接口名称** | List Approval Flow Templates |
| **中文名称** | 获取审批流程模板列表 |
| **路径** | `GET /api/bff/approval-flows` |
| **权限** | `approval:config` |

**返回数据:**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "普通业务审批流程",
      "code": "standard",
      "description": "适用于普通内部项目的合并请求和版本发布",
      "applicableSecretLevels": ["public", "internal"],
      "applicableOperations": ["merge", "version", "branch_create"],
      "steps": [
        {
          "order": 1,
          "name": "项目管理员审批",
          "requiredRole": "project_manager",
          "requiredCount": 1,
          "timeoutHours": 48,
          "allowDelegate": true,
          "autoPassOnTimeout": false
        }
      ],
      "isDefault": true,
      "isActive": true,
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-06-15T00:00:00Z"
    },
    {
      "id": 2,
      "name": "涉密版本多级审批流程",
      "code": "secret_multi_level",
      "description": "适用于涉密及以上等级软件的版本变更",
      "applicableSecretLevels": ["secret", "top-secret"],
      "applicableOperations": ["merge", "version", "baseline", "deprecate"],
      "steps": [
        {
          "order": 1,
          "name": "项目管理员初审",
          "requiredRole": "project_manager",
          "requiredCount": 1,
          "timeoutHours": 24,
          "allowDelegate": false,
          "autoPassOnTimeout": false
        },
        {
          "order": 2,
          "name": "安全审计员复核",
          "requiredRole": "security_auditor",
          "requiredCount": 1,
          "timeoutHours": 48,
          "allowDelegate": false,
          "autoPassOnTimeout": false
        },
        {
          "order": 3,
          "name": "系统管理员终审",
          "requiredRole": "admin",
          "requiredCount": 1,
          "timeoutHours": 72,
          "allowDelegate": true,
          "autoPassOnTimeout": false
        }
      ],
      "isDefault": false,
      "isActive": true,
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-06-15T00:00:00Z"
    },
    {
      "id": 3,
      "name": "紧急修复快速审批流程",
      "code": "hotfix_express",
      "description": "适用于紧急故障修复的快速通道",
      "applicableSecretLevels": ["public", "internal"],
      "applicableOperations": ["merge", "version"],
      "steps": [
        {
          "order": 1,
          "name": "任一管理员审批",
          "requiredRole": "admin",
          "requiredCount": 1,
          "timeoutHours": 4,
          "allowDelegate": true,
          "autoPassOnTimeout": true
        }
      ],
      "isDefault": false,
      "isActive": true,
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-06-15T00:00:00Z"
    }
  ]
}
```

##### 4.2.1.2 创建审批流程模板

| 项目 | 值 |
|------|-----|
| **接口名称** | Create Approval Flow Template |
| **中文名称** | 创建审批流程模板 |
| **路径** | `POST /api/bff/approval-flows` |
| **权限** | `approval:config` |

**请求体:**

```json
{
  "name": "涉密版本多级审批流程",
  "code": "secret_multi_level",
  "description": "适用于涉密及以上等级软件的版本变更",
  "applicableSecretLevels": ["secret", "top-secret"],
  "applicableOperations": ["merge", "version", "baseline", "deprecate"],
  "steps": [
    {
      "order": 1,
      "name": "项目管理员初审",
      "requiredRole": "project_manager",
      "requiredCount": 1,
      "timeoutHours": 24,
      "allowDelegate": false,
      "autoPassOnTimeout": false
    },
    {
      "order": 2,
      "name": "安全审计员复核",
      "requiredRole": "security_auditor",
      "requiredCount": 1,
      "timeoutHours": 48
    },
    {
      "order": 3,
      "name": "系统管理员终审",
      "requiredRole": "admin",
      "requiredCount": 1,
      "timeoutHours": 72,
      "allowDelegate": true
    }
  ]
}
```

##### 4.2.1.3 更新审批流程模板

| 项目 | 值 |
|------|-----|
| **路径** | `PUT /api/bff/approval-flows/:flowId` |

##### 4.2.1.4 删除审批流程模板

| 项目 | 值 |
|------|-----|
| **路径** | `DELETE /api/bff/approval-flows/:flowId` |
| **说明** | 有关联审批单则不允许删除，需先停用 |

#### 4.2.2 审批申请管理

##### 4.2.2.1 创建审批申请

| 项目 | 值 |
|------|-----|
| **接口名称** | Create Approval Request |
| **中文名称** | 创建审批申请 |
| **路径** | `POST /api/bff/approvals` |
| **描述** | 用户提交合并/版本发布/基线/废弃等操作的审批申请 |

**请求体:**

```json
{
  "operationType": "merge",
  "title": "[feature/notification] 新增消息通知模块",
  "description": "详细描述此次变更的内容、范围、影响评估",
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "sourceBranch": "feature/notification",
  "targetBranch": "develop",
  "giteaPRNumber": 12,
  "secretLevel": "internal",
  "urgency": "normal",
  "approvalFlowId": 1,
  "reviewers": ["lisi", "wangwu"],
  "attachments": [
    {
      "fileName": "变更影响评估报告.pdf",
      "fileUrl": "/uploads/2026/07/abc123.pdf",
      "fileSize": 204800
    }
  ],
  "complianceChecklist": {
    "codeReviewCompleted": true,
    "sensitiveDataScanned": true,
    "unitTestCoverage": 85,
    "securityScanPassed": true
  }
}
```

**返回数据:**

```json
{
  "code": 200,
  "message": "审批申请已提交",
  "data": {
    "approvalId": 42,
    "status": "pending",
    "currentStep": 1,
    "nextReviewer": "lisi",
    "estimatedCompletionTime": "2026-07-10T10:00:00Z",
    "createTime": "2026-07-08T10:00:00Z"
  }
}
```

##### 4.2.2.2 获取待审批列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/approvals/pending` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码，默认 1 |
| `pageSize` | integer | 否 | 每页条数，默认 10 |
| `operationType` | string | 否 | `merge` / `version` / `baseline` / `deprecate` |
| `urgency` | string | 否 | `high` / `normal` / `low` |
| `secretLevel` | string | 否 | `public` / `internal` / `secret` / `top-secret` |
| `keyword` | string | 否 | 标题关键词搜索 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "approvalId": 42,
        "operationType": "merge",
        "title": "[feature/notification] 新增消息通知模块",
        "description": "详细描述...",
        "repoOwner": "besti",
        "repoName": "gov-user-service",
        "sourceBranch": "feature/notification",
        "targetBranch": "develop",
        "giteaPRNumber": 12,
        "secretLevel": "internal",
        "urgency": "normal",
        "status": "pending",
        "currentStep": 1,
        "totalSteps": 2,
        "progressPercent": 0,
        "applicant": {
          "userId": 1001,
          "username": "zhangsan",
          "nickname": "张三",
          "departmentId": 2,
          "departmentName": "技术研发部"
        },
        "approvalFlowName": "普通业务审批流程",
        "createTime": "2026-07-08T10:00:00Z",
        "dueTime": "2026-07-10T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10,
    "statistics": {
      "pendingTotal": 5,
      "highUrgency": 1,
      "overdue": 0
    }
  }
}
```

##### 4.2.2.3 获取我的申请列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/approvals/my-applications` |

**请求参数（Query）:** 同上，增加 `status`（`pending` / `approved` / `rejected` / `withdrawn`）

##### 4.2.2.4 获取审批详情

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/approvals/:approvalId` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "approvalId": 42,
    "operationType": "merge",
    "title": "[feature/notification] 新增消息通知模块",
    "description": "详细描述...",
    "repoOwner": "besti",
    "repoName": "gov-user-service",
    "sourceBranch": "feature/notification",
    "targetBranch": "develop",
    "giteaPRNumber": 12,
    "secretLevel": "internal",
    "urgency": "normal",
    "status": "pending",
    "currentStep": 1,
    "totalSteps": 2,
    "approvalFlowName": "普通业务审批流程",
    "applicant": {
      "userId": 1001,
      "username": "zhangsan",
      "nickname": "张三",
      "departmentId": 2,
      "departmentName": "技术研发部"
    },
    "complianceChecklist": {
      "codeReviewCompleted": true,
      "sensitiveDataScanned": true,
      "unitTestCoverage": 85,
      "securityScanPassed": true
    },
    "attachments": [
      {
        "fileName": "变更影响评估报告.pdf",
        "fileUrl": "/uploads/2026/07/abc123.pdf",
        "fileSize": 204800
      }
    ],
    "approvalRecords": [
      {
        "recordId": 1,
        "step": 1,
        "stepName": "项目管理员审批",
        "reviewer": {
          "userId": 1002,
          "username": "lisi",
          "nickname": "李四"
        },
        "action": "approved",
        "comment": "代码审查通过，变更范围合理",
        "actionTime": "2026-07-08T14:00:00Z",
        "durationMinutes": 240
      }
    ],
    "giteaDiff": {
      "additions": 150,
      "deletions": 20,
      "fileChanges": 8,
      "changedFiles": [
        { "path": "src/service/notification.js", "status": "added", "additions": 80, "deletions": 0 },
        { "path": "src/api/index.js", "status": "modified", "additions": 15, "deletions": 5 }
      ]
    },
    "createTime": "2026-07-08T10:00:00Z",
    "updateTime": "2026-07-08T14:00:00Z",
    "dueTime": "2026-07-10T10:00:00Z"
  }
}
```

##### 4.2.2.5 处理审批（通过/拒绝）

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/approvals/:approvalId/:action` |
| **说明** | `action` = `approve` 或 `reject` |

**请求体:**

```json
{
  "comment": "代码质量良好，变更范围合理，通过审批",
  "complianceVerified": true
}
```

**返回数据:**

```json
{
  "code": 200,
  "message": "审批通过",
  "data": {
    "newStatus": "in_progress",
    "currentStep": 2,
    "nextReviewer": "wangwu",
    "remainingSteps": 1,
    "estimatedCompletion": "2026-07-11T10:00:00Z"
  }
}
```

**特殊情况：**

```json
// 最后一级审批通过 → 触发实际操作
{
  "code": 200,
  "message": "审批全部通过，正在执行合并操作",
  "data": {
    "newStatus": "approved",
    "triggeredAction": "merge_pull_request",
    "actionResult": {
      "success": true,
      "giteaResponse": { "merged": true, "message": "Pull Request successfully merged" }
    }
  }
}
```

##### 4.2.2.6 撤回申请

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/approvals/:approvalId/withdraw` |

**请求体:**

```json
{
  "reason": "发现代码缺陷，需要重新修改后提交"
}
```

##### 4.2.2.7 获取审批历史

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/approvals/history` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `operationType` | string | 否 | 操作类型 |
| `status` | string | 否 | `approved` / `rejected` / `withdrawn` |
| `startDate` | string | 否 | 开始日期 `2026-07-01` |
| `endDate` | string | 否 | 结束日期 |
| `applicantUsername` | string | 否 | 申请人 |
| `keyword` | string | 否 | 标题搜索 |

#### 4.2.3 上线合规审批

##### 4.2.3.1 获取合规检查清单

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/compliance/checklist` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `repoOwner` | string | 是 | 仓库所有者 |
| `repoName` | string | 是 | 仓库名称 |
| `targetVersion` | string | 是 | 目标版本号 |
| `secretLevel` | string | 是 | 涉密等级 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "checklist": [
      {
        "id": "code_review",
        "name": "代码审查完成",
        "description": "所有代码变更已通过代码审查",
        "required": true,
        "evidenceRequired": "审查记录链接或截图",
        "status": "passed"
      },
      {
        "id": "sensitive_scan",
        "name": "敏感信息扫描",
        "description": "代码中不包含硬编码密码、密钥、Token等敏感信息",
        "required": true,
        "evidenceRequired": "扫描报告",
        "status": "pending"
      },
      {
        "id": "unit_test",
        "name": "单元测试覆盖率",
        "description": "单元测试覆盖率 ≥ 80%",
        "required": true,
        "evidenceRequired": "测试覆盖率报告",
        "currentValue": 85,
        "threshold": 80,
        "status": "passed"
      },
      {
        "id": "security_scan",
        "name": "安全漏洞扫描",
        "description": "无高危及以上安全漏洞",
        "required": true,
        "evidenceRequired": "安全扫描报告",
        "status": "pending"
      },
      {
        "id": "performance_test",
        "name": "性能测试",
        "description": "关键接口响应时间 ≤ 500ms",
        "required": "secretLevel === 'top-secret'",
        "evidenceRequired": "性能测试报告",
        "status": "skipped"
      }
    ],
    "overallStatus": "incomplete",
    "passedCount": 2,
    "requiredCount": 4,
    "canSubmitForApproval": false,
    "missingItems": ["sensitive_scan", "security_scan"]
  }
}
```

##### 4.2.3.2 提交合规检查结果

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/compliance/checklist/submit` |

**请求体:**

```json
{
  "approvalId": 42,
  "checklistResults": [
    {
      "checkItemId": "sensitive_scan",
      "status": "passed",
      "evidenceUrl": "/uploads/2026/07/scan-report-42.pdf",
      "comment": "扫描通过，未发现敏感信息"
    },
    {
      "checkItemId": "security_scan",
      "status": "passed",
      "evidenceUrl": "/uploads/2026/07/security-report-42.pdf",
      "comment": "无高危漏洞"
    }
  ]
}
```

---

### 4.3 基线归档管理

**对应需求**: FR-004 版本归档与基线封存

#### 4.3.1 基线管理

##### 4.3.1.1 获取基线列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/baselines` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `status` | string | 否 | `active` / `locked` / `deprecated` |
| `repoOwner` | string | 否 | 仓库所有者 |
| `repoName` | string | 否 | 仓库名称 |
| `keyword` | string | 否 | 基线名称/版本号搜索 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "baselineId": 1,
        "repoOwner": "besti",
        "repoName": "gov-user-service",
        "tagName": "v2.0.0",
        "tagSha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        "baselineName": "V2.0 正式基线版本",
        "description": "V2.0 版本通过全部测试和审批，设为正式基线",
        "type": "release",
        "status": "active",
        "isLocked": true,
        "lockedBy": "lisi",
        "lockedAt": "2026-06-15T10:00:00Z",
        "approvalId": 15,
        "approvalStatus": "approved",
        "createdBy": "zhangsan",
        "createTime": "2026-06-10T09:00:00Z",
        "fileCount": 128,
        "totalSize": "45.2 MB",
        "fingerprintSHA256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10
  }
}
```

##### 4.3.1.2 申请基线封存

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/baselines/apply` |

**请求体:**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "tagName": "v2.0.0",
  "baselineName": "V2.0 正式基线版本",
  "description": "V2.0 版本通过全部测试和审批，申请设为正式基线",
  "type": "release",
  "approvalFlowId": 2,
  "autoLockOnApproval": true
}
```

**返回数据:**

```json
{
  "code": 200,
  "message": "基线申请已提交，等待审批",
  "data": {
    "baselineId": 6,
    "approvalId": 43,
    "status": "pending_approval"
  }
}
```

##### 4.3.1.3 锁定/解锁基线

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/baselines/:baselineId/lock` |
| | `POST /api/bff/baselines/:baselineId/unlock` |
| **说明** | 锁定需审批通过后方可执行；基线锁定后其 Git Tag 禁止删除或移动 |

**请求体 (unlock):**

```json
{
  "reason": "因重大安全漏洞需要修复，申请临时解锁基线",
  "approvalFlowId": 2
}
```

##### 4.3.1.4 基线对比

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/baselines/compare` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `sourceBaselineId` | integer | 是 | 源基线 ID |
| `targetBaselineId` | integer | 是 | 目标基线 ID |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "source": { "baselineId": 1, "tagName": "v1.0.0", "createTime": "2026-01-01" },
    "target": { "baselineId": 5, "tagName": "v2.0.0", "createTime": "2026-06-10" },
    "summary": {
      "totalChanges": 45,
      "addedFiles": 12,
      "modifiedFiles": 28,
      "deletedFiles": 5,
      "additions": 3200,
      "deletions": 850
    },
    "changedFiles": [
      {
        "path": "src/service/user.js",
        "status": "modified",
        "additions": 120,
        "deletions": 35,
        "changePercent": 15.5
      }
    ]
  }
}
```

#### 4.3.2 归档管理

##### 4.3.2.1 获取归档列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/archives` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `repoOwner` | string | 否 | 仓库所有者 |
| `repoName` | string | 否 | 仓库名称 |
| `archiveStatus` | string | 否 | `active` / `archived` / `expired` |
| `startDate` | string | 否 | 归档日期起始 |
| `endDate` | string | 否 | 归档日期结束 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "archiveId": 1,
        "repoOwner": "besti",
        "repoName": "gov-user-service",
        "tagName": "v1.0.0",
        "archiveFileName": "gov-user-service-v1.0.0.tar.gz",
        "archiveFileSize": 47316992,
        "archiveFileSHA256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "storagePath": "/data/archives/2026/01/gov-user-service-v1.0.0.tar.gz",
        "storageType": "minio",
        "status": "archived",
        "retentionPolicy": "5 years",
        "retentionExpireDate": "2031-01-15T00:00:00Z",
        "archivedBy": "zhangsan",
        "archiveTime": "2026-01-15T14:00:00Z",
        "description": "V1.0 版本归档存储，保留至 2031年"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 10,
    "statistics": {
      "totalArchives": 12,
      "totalSize": "1.2 GB",
      "expiringCount": 2
    }
  }
}
```

##### 4.3.2.2 创建归档

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/archives` |

**请求体:**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "tagName": "v1.0.0",
  "description": "V1.0 版本归档存储",
  "retentionYears": 5,
  "generateSHA256": true
}
```

**返回数据:**

```json
{
  "code": 200,
  "message": "归档任务已启动",
  "data": {
    "archiveId": 13,
    "status": "processing",
    "estimatedSize": "45 MB",
    "estimatedCompletionTime": "2026-07-08T10:05:00Z"
  }
}
```

##### 4.3.2.3 下载归档

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/archives/:archiveId/download` |
| **说明** | 返回文件流，`Content-Type: application/octet-stream`，`Content-Disposition: attachment` |
| **权限** | `repo:download`，涉密版本需额外审批 |

##### 4.3.2.4 删除归档

| 项目 | 值 |
|------|-----|
| **路径** | `DELETE /api/bff/archives/:archiveId` |
| **说明** | 需管理员审批，未到期归档不允许删除 |

##### 4.3.2.5 从归档还原

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/archives/:archiveId/restore` |

**请求体:**

```json
{
  "targetRepoOwner": "besti",
  "targetRepoName": "gov-user-service",
  "newBranchName": "restored-v1.0.0",
  "reason": "需要回溯 V1.0 版本进行安全审计"
}
```

---

### 4.4 版本废弃管理

**对应需求**: FR-006 版本废弃管理

#### 4.4.1 申请版本废弃

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/version-deprecations` |

**请求体:**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "tagName": "v1.0.0",
  "reason": "版本存在严重安全漏洞 CVE-2026-1234，建议废弃并升级至 v2.0.0",
  "deprecationType": "security",
  "migrationVersion": "v2.0.0",
  "approvalFlowId": 2
}
```

#### 4.4.2 获取废弃版本列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/version-deprecations` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `status` | string | 否 | `pending` / `approved` / `deprecated` / `rejected` |
| `deprecationType` | string | 否 | `security` / `obsolete` / `bug` / `policy` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "deprecationId": 1,
        "repoOwner": "besti",
        "repoName": "gov-user-service",
        "tagName": "v1.0.0",
        "reason": "存在严重安全漏洞",
        "deprecationType": "security",
        "status": "deprecated",
        "migrationVersion": "v2.0.0",
        "approvalId": 20,
        "deprecatedBy": "zhangsan",
        "deprecationTime": "2026-06-20T10:00:00Z",
        "blockedFromDeploy": true,
        "blockedFromMerge": true
      }
    ],
    "total": 3
  }
}
```

#### 4.4.3 校验版本是否可用

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/version-deprecations/check` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `repoOwner` | string | 是 | 仓库所有者 |
| `repoName` | string | 是 | 仓库名称 |
| `tagName` | string | 是 | 版本号 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "tagName": "v1.0.0",
    "isDeprecated": true,
    "canDeploy": false,
    "canMerge": false,
    "deprecationReason": "存在严重安全漏洞 CVE-2026-1234",
    "recommendedUpgrade": "v2.0.0",
    "blockMessage": "该版本已废弃，禁止用于迭代与上线，请升级至 v2.0.0"
  }
}
```

---

### 4.5 权限与身份管控

**对应需求**: FR-015, FR-016, FR-017, FR-018

#### 4.5.1 角色管理

##### 4.5.1.1 获取角色列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/roles` |
| **权限** | `admin:manage` |

**返回数据:**

```json
{
  "code": 200,
  "data": [
    {
      "roleId": 1,
      "name": "系统管理员",
      "code": "admin",
      "description": "拥有系统全部管理权限",
      "isSystem": true,
      "userCount": 2,
      "permissions": ["*"],
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-01-01T00:00:00Z"
    },
    {
      "roleId": 2,
      "name": "项目管理员",
      "code": "project_manager",
      "description": "管理所辖项目的仓库、成员和审批",
      "isSystem": true,
      "userCount": 5,
      "permissions": [
        "repo:create", "repo:edit", "repo:delete", "repo:download",
        "branch:create", "branch:delete", "branch:protect",
        "tag:create", "tag:delete",
        "approval:approve", "approval:config",
        "member:manage"
      ],
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-06-15T00:00:00Z"
    },
    {
      "roleId": 3,
      "name": "开发人员",
      "code": "developer",
      "description": "日常代码开发，提交代码和创建分支",
      "isSystem": true,
      "userCount": 20,
      "permissions": [
        "repo:download",
        "branch:create",
        "tag:create"
      ],
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-01-01T00:00:00Z"
    },
    {
      "roleId": 4,
      "name": "安全审计员",
      "code": "security_auditor",
      "description": "审计日志查看、安全合规审查",
      "isSystem": true,
      "userCount": 3,
      "permissions": [
        "audit:view", "audit:export",
        "repo:download",
        "approval:approve"
      ],
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-01-01T00:00:00Z"
    },
    {
      "roleId": 5,
      "name": "普通查看员",
      "code": "viewer",
      "description": "仅可查看公开版本信息，不可操作",
      "isSystem": true,
      "userCount": 10,
      "permissions": [
        "repo:download"
      ],
      "createTime": "2026-01-01T00:00:00Z",
      "updateTime": "2026-01-01T00:00:00Z"
    }
  ]
}
```

##### 4.5.1.2 创建/更新/删除角色

| 操作 | 路径 |
|------|------|
| 创建 | `POST /api/bff/roles` |
| 更新 | `PUT /api/bff/roles/:roleId` |
| 删除 | `DELETE /api/bff/roles/:roleId` |

#### 4.5.2 权限体系

##### 4.5.2.1 获取全量权限列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/permissions` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "permissionGroups": [
      {
        "groupName": "仓库管理",
        "permissions": [
          { "key": "repo:create", "name": "创建仓库", "description": "创建新的代码仓库" },
          { "key": "repo:edit", "name": "编辑仓库", "description": "修改仓库名称、描述、设置" },
          { "key": "repo:delete", "name": "删除仓库", "description": "删除仓库及其所有数据" },
          { "key": "repo:download", "name": "下载仓库", "description": "克隆和下载仓库代码及制品" }
        ]
      },
      {
        "groupName": "分支管理",
        "permissions": [
          { "key": "branch:create", "name": "创建分支", "description": "创建新的开发/修复分支" },
          { "key": "branch:delete", "name": "删除分支", "description": "删除非保护分支" },
          { "key": "branch:protect", "name": "保护分支", "description": "设置/取消分支保护" }
        ]
      },
      {
        "groupName": "版本管理",
        "permissions": [
          { "key": "tag:create", "name": "创建版本", "description": "创建版本标签" },
          { "key": "tag:delete", "name": "删除版本", "description": "删除版本标签" },
          { "key": "baseline:manage", "name": "基线管理", "description": "创建、锁定、解锁基线版本" },
          { "key": "archive:manage", "name": "归档管理", "description": "创建、删除、还原归档" }
        ]
      },
      {
        "groupName": "审批管理",
        "permissions": [
          { "key": "approval:approve", "name": "审批操作", "description": "对审批申请进行通过/拒绝操作" },
          { "key": "approval:config", "name": "配置审批流程", "description": "创建和修改审批流程模板" }
        ]
      },
      {
        "groupName": "审计管理",
        "permissions": [
          { "key": "audit:view", "name": "查看审计日志", "description": "查看操作审计日志和风险预警" },
          { "key": "audit:export", "name": "导出审计报表", "description": "导出审计日志和生成报表" }
        ]
      },
      {
        "groupName": "系统管理",
        "permissions": [
          { "key": "admin:manage", "name": "系统管理", "description": "用户管理、角色管理、系统设置" },
          { "key": "member:manage", "name": "成员管理", "description": "管理仓库成员和权限" },
          { "key": "backup:manage", "name": "备份管理", "description": "创建、恢复、删除备份" }
        ]
      }
    ]
  }
}
```

#### 4.5.3 部门数据隔离

##### 4.5.3.1 获取部门树

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/departments` |
| **权限** | `admin:manage` (全部) / 普通用户仅返回本部门 |

**返回数据:**

```json
{
  "code": 200,
  "data": [
    {
      "departmentId": 1,
      "name": "信息化建设办公室",
      "code": "info_office",
      "parentId": null,
      "sortOrder": 1,
      "leader": "张主任",
      "userCount": 35,
      "repoCount": 15,
      "children": [
        {
          "departmentId": 2,
          "name": "技术研发部",
          "code": "tech_rd",
          "parentId": 1,
          "sortOrder": 1,
          "leader": "李部长",
          "userCount": 12,
          "repoCount": 8,
          "children": []
        }
      ]
    }
  ]
}
```

##### 4.5.3.2 管理操作

| 操作 | 路径 |
|------|------|
| 创建部门 | `POST /api/bff/departments` |
| 更新部门 | `PUT /api/bff/departments/:deptId` |
| 删除部门 | `DELETE /api/bff/departments/:deptId` |
| 部门成员列表 | `GET /api/bff/departments/:deptId/members` |
| 添加成员 | `POST /api/bff/departments/:deptId/members` |
| 移除成员 | `DELETE /api/bff/departments/:deptId/members/:userId` |

#### 4.5.4 身份鉴权增强

##### 4.5.4.1 异常登录检测

| 项目 | 值 |
|------|-----|
| **路径** | BFF 中间件自动执行，无需前端调用 |
| **触发条件** | ① 新 IP 首次登录 ② 5 分钟内失败 ≥ 5 次 ③ 异地同时登录 ④ 非工作时间登录 |
| **响应** | 触发 MFA 二次验证 或 冻结账号 + 向管理员告警 |

##### 4.5.4.2 会话管理

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/sessions/active` |
| **描述** | 获取当前用户所有活跃会话 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "sessions": [
      {
        "sessionId": "sess_abc123",
        "ip": "192.168.1.100",
        "userAgent": "Chrome/120.0 Windows",
        "loginTime": "2026-07-08T08:00:00Z",
        "lastActivity": "2026-07-08T10:30:00Z",
        "isCurrent": true
      }
    ]
  }
}
```

##### 4.5.4.3 强制下线

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/sessions/:sessionId/revoke` |

---

### 4.6 审计日志系统

**对应需求**: FR-019, FR-020, FR-021

#### 4.6.1 审计日志中间件自动记录

BFF 层的 Express/Koa 中间件自动拦截所有 API 请求，记录以下信息：

```json
{
  "logId": "AUDIT-20260708-000001",
  "timestamp": "2026-07-08T10:30:25.123Z",
  "userId": 1001,
  "username": "zhangsan",
  "nickname": "张三",
  "departmentId": 2,
  "departmentName": "技术研发部",
  "role": "developer",
  "action": "POST /api/bff/approvals",
  "actionType": "create_approval",
  "actionName": "创建审批申请",
  "targetType": "approval",
  "targetId": 42,
  "targetName": "[feature/notification] 新增消息通知模块",
  "requestIP": "192.168.1.100",
  "requestUserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
  "requestMethod": "POST",
  "requestPath": "/api/bff/approvals",
  "requestBody": "{\"operationType\":\"merge\",\"title\":\"...\"}",
  "responseStatus": 200,
  "responseTime": 320,
  "result": "success",
  "errorMessage": null,
  "sessionId": "sess_abc123",
  "geoLocation": {
    "country": "中国",
    "province": "北京",
    "city": "北京"
  },
  "integrityHash": "sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
}
```

#### 4.6.2 查询审计日志

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/audit/logs` |
| **权限** | `audit:view` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数，默认 20，最大 100 |
| `username` | string | 否 | 操作用户（精确匹配） |
| `nickname` | string | 否 | 用户姓名（模糊匹配） |
| `departmentId` | integer | 否 | 部门 ID |
| `actionType` | string | 否 | `login` / `logout` / `create_repo` / `delete_repo` / `create_branch` / `delete_branch` / `create_tag` / `delete_tag` / `create_approval` / `approve` / `reject` / `merge_pr` / `clone` / `download` / `create_baseline` / `lock_baseline` / `create_archive` / `restore_archive` / `deprecate_version` / `create_user` / `update_user` / `delete_user` / `update_role` / `change_settings` |
| `targetType` | string | 否 | `repo` / `branch` / `tag` / `approval` / `baseline` / `archive` / `user` / `role` / `system` |
| `targetName` | string | 否 | 操作对象名称 |
| `result` | string | 否 | `success` / `failure` |
| `startDate` | string | 否 | `2026-07-01T00:00:00Z` |
| `endDate` | string | 否 | `2026-07-08T23:59:59Z` |
| `requestIP` | string | 否 | 来源 IP |
| `sortBy` | string | 否 | `timestamp` (默认) / `responseTime` |
| `sortOrder` | string | 否 | `desc` (默认) / `asc` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [ /* 日志条目数组，结构同 4.6.1 */ ],
    "total": 12560,
    "page": 1,
    "pageSize": 20,
    "statistics": {
      "totalToday": 230,
      "failureCount": 3,
      "uniqueUsers": 15,
      "topActions": [
        { "actionType": "create_approval", "count": 45 },
        { "actionType": "merge_pr", "count": 12 }
      ]
    }
  }
}
```

#### 4.6.3 获取日志详情

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/audit/logs/:logId` |

**返回数据:** 单条完整日志（含完整 requestBody 和 responseBody）

#### 4.6.4 导出审计日志

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/audit/logs/export` |
| **权限** | `audit:export` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `format` | string | 是 | `xlsx` / `csv` / `pdf` |
| `columns` | array | 否 | 导出列选择，默认全部 |
| 筛选参数 | - | 否 | 同 4.6.2 查询参数 |

**返回:** 文件流，`Content-Type` 对应对应 MIME 类型

#### 4.6.5 日志完整性校验

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/audit/logs/verify` |
| **描述** | 后台管理员触发日志完整性校验，验证 SHA-256 链 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "totalLogs": 12560,
    "verifiedLogs": 12560,
    "tamperedLogs": 0,
    "lastIntegrityHash": "sha256:...",
    "verifiedAt": "2026-07-08T11:00:00Z"
  }
}
```

---

### 4.7 合规审计报表

**对应需求**: FR-022 合规审计报表导出

#### 4.7.1 报表模板列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/reports/templates` |

**返回数据:**

```json
{
  "code": 200,
  "data": [
    {
      "templateId": 1,
      "name": "版本变更统计报表",
      "type": "version_stats",
      "description": "统计指定时间段内各仓库的版本变更数量、频率、趋势",
      "outputFormats": ["pdf", "xlsx"],
      "parameters": [
        { "name": "startDate", "label": "开始日期", "type": "date", "required": true },
        { "name": "endDate", "label": "结束日期", "type": "date", "required": true },
        { "name": "repoIds", "label": "仓库范围", "type": "multi_select", "required": false },
        { "name": "departmentIds", "label": "部门范围", "type": "multi_select", "required": false }
      ]
    },
    {
      "templateId": 2,
      "name": "操作审计月报",
      "type": "audit_monthly",
      "description": "按月生成操作审计汇总报表，含登录、提交、审批、下载统计",
      "outputFormats": ["pdf", "xlsx"]
    },
    {
      "templateId": 3,
      "name": "审批汇总报表",
      "type": "approval_summary",
      "description": "统计审批通过率、平均耗时、审批人工作量",
      "outputFormats": ["pdf", "xlsx"]
    },
    {
      "templateId": 4,
      "name": "风险预警报表",
      "type": "risk_report",
      "description": "汇总风险预警信息、处理状态、趋势分析",
      "outputFormats": ["pdf", "xlsx"]
    }
  ]
}
```

#### 4.7.2 生成报表

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/reports/generate` |

**请求体:**

```json
{
  "templateId": 1,
  "format": "pdf",
  "name": "2026年7月版本变更统计报表",
  "parameters": {
    "startDate": "2026-07-01",
    "endDate": "2026-07-31",
    "departmentIds": [1, 2]
  },
  "scheduleGenerate": false
}
```

**返回数据:**

```json
{
  "code": 200,
  "message": "报表生成任务已启动",
  "data": {
    "reportId": 15,
    "status": "generating",
    "estimatedTime": 30,
    "downloadUrl": null
  }
}
```

#### 4.7.3 报表状态查询

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/reports/:reportId/status` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "reportId": 15,
    "status": "completed",
    "progress": 100,
    "fileSize": 2457600,
    "fileType": "pdf",
    "downloadUrl": "/api/bff/reports/15/download",
    "generatedAt": "2026-07-08T10:05:30Z",
    "expireTime": "2026-07-15T10:05:30Z"
  }
}
```

#### 4.7.4 下载报表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/reports/:reportId/download` |
| **返回:** 文件流 |

#### 4.7.5 报表历史

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/reports/history` |

---

### 4.8 安全与备份管理

**对应需求**: FR-023, FR-024, FR-025, FR-026

#### 4.8.1 备份管理

##### 4.8.1.1 获取备份列表与统计

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/backups` |
| **权限** | `backup:manage` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "backupId": 1,
        "name": "数据库全量备份_20260708_0200",
        "type": "auto",
        "scope": "full",
        "status": "completed",
        "progress": 100,
        "fileSize": 131072000,
        "storagePath": "/data/backups/2026/07/08/full_20260708_0200.dump",
        "checksumSHA256": "abc123...",
        "startTime": "2026-07-08T02:00:00Z",
        "endTime": "2026-07-08T02:05:30Z",
        "durationSeconds": 330,
        "createdBy": "system"
      }
    ],
    "statistics": {
      "totalBackups": 30,
      "totalSize": 4080218931,
      "lastSuccessfulBackup": "2026-07-08T02:00:00Z",
      "nextScheduledBackup": "2026-07-09T02:00:00Z",
      "averageBackupDurationSeconds": 300,
      "failedBackups": 1
    },
    "schedules": [
      {
        "scheduleId": 1,
        "name": "每日自动备份",
        "cronExpression": "0 2 * * *",
        "scope": "full",
        "retentionDays": 30,
        "enabled": true,
        "lastRunTime": "2026-07-08T02:00:00Z",
        "lastRunStatus": "success"
      }
    ]
  }
}
```

##### 4.8.1.2 创建即时备份

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/backups` |

**请求体:**

```json
{
  "name": "版本v2.0.0上线前手动备份",
  "scope": "full",
  "description": "V2.0 重大版本上线前的手动全量备份",
  "includeGitRepos": true,
  "notifyOnCompletion": true
}
```

##### 4.8.1.3 恢复备份

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/backups/:backupId/restore` |
| **说明** | 恢复操作计入审计日志，需二次确认 |

**请求体:**

```json
{
  "confirmed": true,
  "restoreType": "full",
  "confirmationCode": "RESTORE-CONFIRM"
}
```

##### 4.8.1.4 更新备份计划

| 项目 | 值 |
|------|-----|
| **路径** | `PUT /api/bff/backups/schedules/:scheduleId` |

**请求体:**

```json
{
  "cronExpression": "0 3 * * *",
  "scope": "full",
  "retentionDays": 60,
  "enabled": true
}
```

#### 4.8.2 文件防篡改校验

##### 4.8.2.1 获取文件校验状态

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/integrity/status` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `repoOwner` | string | 是 | 仓库所有者 |
| `repoName` | string | 是 | 仓库名称 |
| `tagName` | string | 否 | 版本号（不传则检查最新版） |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "repoFullName": "besti/gov-user-service",
    "tagName": "v2.0.0",
    "totalFiles": 128,
    "verifiedFiles": 128,
    "alteredFiles": 0,
    "missingFiles": 0,
    "lastVerifiedAt": "2026-07-08T06:00:00Z",
    "fingerprints": [
      {
        "filePath": "src/service/user.js",
        "expectedSHA256": "e3b0c44298fc1c149afbf4c8996fb924...",
        "actualSHA256": "e3b0c44298fc1c149afbf4c8996fb924...",
        "matched": true
      }
    ],
    "overallIntegrity": "intact"
  }
}
```

##### 4.8.2.2 触发全量校验

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/integrity/verify` |

**请求体:**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "tagName": "v2.0.0"
}
```

#### 4.8.3 涉密数据防泄漏

##### 4.8.3.1 下载审批与限流

BFF 中间件在文件下载请求时检查：
- 涉密等级 ≥ `secret` → 需下载审批
- 单用户每日下载 ≤ 配置阈值（默认 10 次）
- 单用户每小时下载流量 ≤ 配置阈值（默认 500MB）
- 高频下载触发告警

##### 4.8.3.2 下载水印注入

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/files/download/:fileId` |
| **说明** | 涉密文件自动注入隐形水印（含下载人、时间、审批单号） |

---

### 4.9 风险监控预警

**对应需求**: FR-028 系统风险监控预警

#### 4.9.1 获取风险预警列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/risk-warnings` |
| **权限** | `audit:view` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `status` | string | 否 | `unhandled` / `handled` / `ignored` |
| `level` | string | 否 | `critical` / `high` / `medium` / `low` |
| `type` | string | 否 | `abnormal_login` / `excessive_download` / `unauthorized_access` / `file_tamper` / `system_overload` / `backup_failure` |
| `startDate` | string | 否 | 开始日期 |
| `endDate` | string | 否 | 结束日期 |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "warningId": 1,
        "level": "high",
        "type": "abnormal_login",
        "title": "异常登录检测：用户 zhangsan 多次登录失败",
        "description": "IP 192.168.1.100 在过去 5 分钟内尝试登录 12 次，失败 10 次，超过阈值（5次）",
        "relatedUserId": 1001,
        "relatedUsername": "zhangsan",
        "sourceIP": "192.168.1.100",
        "geoLocation": { "country": "中国", "province": "未知", "city": "未知" },
        "triggeredRule": "LOGIN_FAILURE_RATE",
        "triggeredValue": 10,
        "ruleThreshold": 5,
        "status": "unhandled",
        "recommendedAction": "建议立即联系用户确认身份，必要时冻结账号",
        "createTime": "2026-07-08T10:30:00Z"
      }
    ],
    "total": 5,
    "statistics": {
      "unhandled": 2,
      "critical": 0,
      "high": 1,
      "medium": 1,
      "low": 0
    }
  }
}
```

#### 4.9.2 处理风险预警

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/risk-warnings/:warningId/handle` |

**请求体:**

```json
{
  "action": "handle",
  "comment": "已确认，用户忘记密码导致多次失败，已协助重置密码",
  "actions_taken": [
    "已联系用户确认身份",
    "已重置密码",
    "已解除登录限制"
  ]
}
```

#### 4.9.3 忽略风险预警

| 项目 | 值 |
|------|-----|
| **路径** | `POST /api/bff/risk-warnings/:warningId/ignore` |

**请求体:**

```json
{
  "reason": "确认为自动化测试脚本产生的误报"
}
```

#### 4.9.4 风险预警规则配置

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/risk-warnings/rules` |
| | `PUT /api/bff/risk-warnings/rules` |

**PUT 请求体:**

```json
{
  "rules": [
    {
      "ruleId": "LOGIN_FAILURE_RATE",
      "name": "异常登录检测",
      "enabled": true,
      "threshold": { "failureCount": 5, "timeWindowMinutes": 5 },
      "level": "high",
      "actions": ["notify_admin", "freeze_account"]
    },
    {
      "ruleId": "EXCESSIVE_DOWNLOAD",
      "name": "高频下载检测",
      "enabled": true,
      "threshold": { "dailyCount": 50, "hourlyBandwidthMB": 1024 },
      "level": "medium",
      "actions": ["notify_admin", "warn_user"]
    },
    {
      "ruleId": "UNAUTHORIZED_ACCESS",
      "name": "越权访问检测",
      "enabled": true,
      "threshold": { "attemptCount": 3, "timeWindowMinutes": 10 },
      "level": "critical",
      "actions": ["notify_admin", "block_ip", "freeze_account"]
    },
    {
      "ruleId": "FILE_TAMPER_DETECTED",
      "name": "文件篡改检测",
      "enabled": true,
      "threshold": { "alteredFiles": 1 },
      "level": "critical",
      "actions": ["notify_admin", "lock_repo", "trigger_audit"]
    },
    {
      "ruleId": "SYSTEM_OVERLOAD",
      "name": "系统过载检测",
      "enabled": true,
      "threshold": { "cpuPercent": 90, "memoryPercent": 85, "diskPercent": 90 },
      "level": "high",
      "actions": ["notify_admin", "auto_scale"]
    },
    {
      "ruleId": "BACKUP_FAILURE",
      "name": "备份失败检测",
      "enabled": true,
      "threshold": { "consecutiveFailures": 2 },
      "level": "high",
      "actions": ["notify_admin"]
    }
  ]
}
```

---

### 4.10 通知系统

**对应需求**: FR-028（弹窗预警）+ 系统通知

#### 4.10.1 获取通知列表

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/notifications` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `isRead` | boolean | 否 | 已读/未读筛选 |
| `type` | string | 否 | `approval` / `warning` / `system` / `backup` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "notificationId": 1,
        "type": "approval",
        "title": "您有一条新的审批待办",
        "content": "zhangsan 提交了合并请求审批：[feature/notification] 新增消息通知模块",
        "relatedType": "approval",
        "relatedId": 42,
        "isRead": false,
        "createTime": "2026-07-08T10:00:00Z"
      }
    ],
    "total": 10,
    "unreadCount": 3
  }
}
```

#### 4.10.2 标记已读

| 操作 | 路径 |
|------|------|
| 单条已读 | `PUT /api/bff/notifications/:notificationId/read` |
| 全部已读 | `PUT /api/bff/notifications/read-all` |

#### 4.10.3 获取未读数量

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/notifications/unread-count` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "total": 3,
    "byType": {
      "approval": 2,
      "warning": 1
    }
  }
}
```

---

### 4.11 系统配置管理

**对应需求**: FR-011, FR-027（配置层面）

#### 4.11.1 获取全部系统配置

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/system/config` |
| **权限** | `admin:manage` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "general": {
      "systemName": "党政软件版本管控平台",
      "systemVersion": "2.0.0",
      "language": "zh-CN",
      "timezone": "Asia/Shanghai"
    },
    "security": {
      "sessionTimeoutMinutes": 480,
      "maxLoginAttempts": 5,
      "lockoutDurationMinutes": 30,
      "mfaEnabled": false,
      "passwordPolicy": {
        "minLength": 8,
        "requireUppercase": true,
        "requireLowercase": true,
        "requireDigit": true,
        "requireSpecialChar": false,
        "expireDays": 90,
        "historyCheckCount": 5
      },
      "ipWhitelist": [],
      "ipBlacklist": []
    },
    "download": {
      "maxDailyDownloads": 50,
      "maxHourlyBandwidthMB": 1024,
      "watermarkEnabled": true,
      "downloadApprovalRequired": "secret"
    },
    "backup": {
      "autoBackupEnabled": true,
      "backupSchedule": "0 2 * * *",
      "retentionDays": 30,
      "backupScope": "full",
      "backupStoragePath": "/data/backups"
    },
    "audit": {
      "logRetentionDays": 3650,
      "integrityCheckSchedule": "0 6 * * 0",
      "tamperAlertEnabled": true
    }
  }
}
```

#### 4.11.2 更新系统配置

| 项目 | 值 |
|------|-----|
| **路径** | `PUT /api/bff/system/config` |

**请求体:** 按模块传，结构同上（部分更新）

---

### 4.12 统计看板

**对应需求**: FR-009（分支状态可视化）+ 仪表盘数据

#### 4.12.1 获取仪表盘数据

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/statistics/dashboard` |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "overview": {
      "totalRepos": 24,
      "totalBranches": 156,
      "totalTags": 89,
      "totalUsers": 35,
      "onlineUsers": 12,
      "pendingApprovals": 5,
      "todayCommits": 47,
      "todayMerges": 8
    },
    "branchStats": {
      "protectedBranches": 18,
      "activeBranches": 45,
      "staleBranches": 23,
      "pendingMerges": 12,
      "conflictingMerges": 3
    },
    "versionStats": {
      "releaseVersions": 15,
      "betaVersions": 30,
      "baselineVersions": 5,
      "deprecatedVersions": 8,
      "archivedVersions": 12
    },
    "approvalStats": {
      "pendingApprovals": 5,
      "approvedToday": 3,
      "rejectedToday": 1,
      "averageApprovalHours": 18.5
    },
    "securityStats": {
      "unhandledRisks": 2,
      "failedLogins": 3,
      "tamperAlerts": 0,
      "systemHealth": "healthy"
    },
    "recentActivities": [
      {
        "activityId": 1,
        "userId": 1001,
        "username": "zhangsan",
        "nickname": "张三",
        "action": "提交了代码",
        "description": "向 besti/gov-user-service 的 feature/auth 分支提交了 3 个文件变更",
        "targetType": "commit",
        "targetUrl": "/repos/besti/gov-user-service/commits/a1b2c3d",
        "time": "2026-07-08T10:20:00Z"
      }
    ],
    "trendData": {
      "dailyCommits": { "labels": ["07-01","07-02","07-03","07-04","07-05","07-06","07-07"], "values": [12,18,15,22,19,25,8] },
      "dailyMerges": { "labels": ["07-01","07-02","07-03","07-04","07-05","07-06","07-07"], "values": [3,5,2,4,6,3,1] },
      "dailyDownloads": { "labels": ["07-01","07-02","07-03","07-04","07-05","07-06","07-07"], "values": [7,4,8,12,9,15,3] }
    }
  }
}
```

#### 4.12.2 获取分支状态详情

| 项目 | 值 |
|------|-----|
| **路径** | `GET /api/bff/statistics/branch-status` |

**请求参数（Query）:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `repoOwner` | string | 否 | 仓库所有者 |
| `repoName` | string | 否 | 仓库名称（不传则全局） |

**返回数据:**

```json
{
  "code": 200,
  "data": {
    "branches": [
      {
        "repoFullName": "besti/gov-user-service",
        "branchName": "develop",
        "branchType": "development",
        "protection": "protected",
        "latestCommit": { "sha": "a1b2c3d", "message": "Update user service", "author": "lisi", "time": "2026-07-08T09:00:00Z" },
        "behindMainBy": 3,
        "aheadOfMainBy": 12,
        "openPullRequests": 2,
        "conflictStatus": "clean",
        "lastActivity": "2026-07-08T09:30:00Z",
        "staleDays": 0,
        "contributors": ["zhangsan", "lisi", "wangwu"]
      }
    ]
  }
}
```

---

## 5. 数据库设计

### 5.1 数据库选型说明

**选型**: openGauss 5.0（华为开源关系型数据库，PostgreSQL 9.2.4 内核兼容）

**选型理由:**
- openGauss 是信创名录推荐数据库，适配党政机关合规要求
- 基于 PostgreSQL 9.2.4 内核演进，兼容 PostgreSQL 协议和生态工具链
- Node.js 驱动使用 `pg` (node-postgres) + Knex.js，驱动支持完善
- 支持 JSONB 类型、窗口函数、CTE、物化视图等高级特性
- 原生支持主备复制、逻辑复制，满足高可用需求
- 支持 ARM64（aarch64）架构，适配鲲鹏/麒麟国产化环境
- 全密态计算、动态脱敏等安全特性，满足涉密系统安全需求

**核心配置参数（postgresql.conf 推荐）:**

```ini
listen_addresses = '0.0.0.0'
port = 5432
max_connections = 500
shared_buffers = 2GB
effective_cache_size = 6GB
wal_level = replica
max_wal_size = 10GB
log_statement = 'mod'
log_duration = ON
log_min_duration_statement = 2000
password_encryption_type = 1
```

### 5.2 核心表结构（openGauss / PostgreSQL DDL）

```sql
-- 审批申请表
CREATE TABLE approvals (
    approval_id         INT AUTO_INCREMENT PRIMARY KEY,
    operation_type      VARCHAR(20) NOT NULL COMMENT 'merge/version/baseline/deprecate',
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    repo_owner          VARCHAR(100),
    repo_name           VARCHAR(100),
    source_branch       VARCHAR(200),
    target_branch       VARCHAR(200),
    gitea_pr_number     INT,
    tag_name            VARCHAR(100),
    secret_level        VARCHAR(20) DEFAULT 'internal',
    urgency             VARCHAR(10) DEFAULT 'normal',
    status              VARCHAR(20) DEFAULT 'pending',
    current_step        INT DEFAULT 1,
    total_steps         INT,
    approval_flow_id    INT,
    applicant_user_id   INT NOT NULL,
    compliance_data     JSON DEFAULT ('{}'),
    attachments         JSON DEFAULT ('[]'),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at        DATETIME,
    INDEX idx_approvals_status (status),
    INDEX idx_approvals_applicant (applicant_user_id),
    INDEX idx_approvals_flow (approval_flow_id),
    INDEX idx_approvals_created (created_at),
    CONSTRAINT fk_approvals_flow FOREIGN KEY (approval_flow_id) REFERENCES approval_flows(flow_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 审批记录表
CREATE TABLE approval_records (
    record_id           INT AUTO_INCREMENT PRIMARY KEY,
    approval_id         INT NOT NULL,
    step                INT NOT NULL,
    step_name           VARCHAR(100),
    reviewer_user_id    INT NOT NULL,
    action              VARCHAR(20) COMMENT 'approved/rejected/delegated',
    comment             TEXT,
    action_time         DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_records_approval (approval_id),
    INDEX idx_records_reviewer (reviewer_user_id),
    CONSTRAINT fk_records_approval FOREIGN KEY (approval_id) REFERENCES approvals(approval_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 审批流程模板表
CREATE TABLE approval_flows (
    flow_id             INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    code                VARCHAR(50) NOT NULL,
    description         TEXT,
    applicable_secret_levels JSON DEFAULT ('[]') COMMENT 'JSON: ["public","internal","secret","top-secret"]',
    applicable_operations   JSON DEFAULT ('[]') COMMENT 'JSON: ["merge","version","baseline","deprecate"]',
    steps               JSON NOT NULL COMMENT 'JSON: [{order, name, requiredRole, requiredCount, timeoutHours}]',
    is_default          TINYINT(1) DEFAULT 0,
    is_active           TINYINT(1) DEFAULT 1,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_flow_code (code),
    INDEX idx_flows_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 基线表
CREATE TABLE baselines (
    baseline_id         INT AUTO_INCREMENT PRIMARY KEY,
    repo_owner          VARCHAR(100) NOT NULL,
    repo_name           VARCHAR(100) NOT NULL,
    tag_name            VARCHAR(100) NOT NULL,
    tag_sha             VARCHAR(64) NOT NULL,
    baseline_name       VARCHAR(200),
    description         TEXT,
    type                VARCHAR(20) DEFAULT 'release',
    status              VARCHAR(20) DEFAULT 'active',
    is_locked           TINYINT(1) DEFAULT 0,
    locked_by           INT,
    locked_at           DATETIME,
    approval_id         INT,
    created_by          INT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_baselines_repo (repo_owner, repo_name),
    INDEX idx_baselines_status (status),
    INDEX idx_baselines_approval (approval_id),
    CONSTRAINT fk_baselines_approval FOREIGN KEY (approval_id) REFERENCES approvals(approval_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 归档表
CREATE TABLE archives (
    archive_id          INT AUTO_INCREMENT PRIMARY KEY,
    repo_owner          VARCHAR(100) NOT NULL,
    repo_name           VARCHAR(100) NOT NULL,
    tag_name            VARCHAR(100) NOT NULL,
    archive_file_name   VARCHAR(255),
    archive_file_size   BIGINT,
    archive_file_sha256 VARCHAR(64),
    storage_path        VARCHAR(500),
    storage_type        VARCHAR(20) DEFAULT 'minio',
    status              VARCHAR(20) DEFAULT 'active',
    retention_expire    DATETIME,
    archived_by         INT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_archives_repo (repo_owner, repo_name),
    INDEX idx_archives_expire (retention_expire),
    INDEX idx_archives_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 版本废弃表
CREATE TABLE version_deprecations (
    deprecation_id      INT AUTO_INCREMENT PRIMARY KEY,
    repo_owner          VARCHAR(100) NOT NULL,
    repo_name           VARCHAR(100) NOT NULL,
    tag_name            VARCHAR(100) NOT NULL,
    reason              TEXT,
    deprecation_type    VARCHAR(20) COMMENT 'security/obsolete/bug/policy',
    status              VARCHAR(20) DEFAULT 'pending',
    migration_version   VARCHAR(100),
    approval_id         INT,
    deprecated_by       INT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_deprec_repo (repo_owner, repo_name),
    INDEX idx_deprec_status (status),
    INDEX idx_deprec_approval (approval_id),
    CONSTRAINT fk_deprec_approval FOREIGN KEY (approval_id) REFERENCES approvals(approval_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 审计日志表（按月分区以支撑大量写入）
CREATE TABLE audit_logs (
    log_id              VARCHAR(30) NOT NULL,
    timestamp           DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id             INT,
    username            VARCHAR(100),
    nickname            VARCHAR(100),
    department_id       INT,
    department_name     VARCHAR(100),
    role_code           VARCHAR(50),
    action_type         VARCHAR(30) NOT NULL,
    action_name         VARCHAR(100),
    target_type         VARCHAR(30),
    target_id           VARCHAR(100),
    target_name         VARCHAR(200),
    request_method      VARCHAR(10),
    request_path        VARCHAR(500),
    request_body        MEDIUMTEXT,
    request_ip          VARCHAR(45),
    request_user_agent  TEXT,
    response_status     INT,
    response_time_ms    INT,
    result              VARCHAR(10),
    error_message       TEXT,
    session_id          VARCHAR(100),
    geo_country         VARCHAR(50),
    geo_province        VARCHAR(50),
    geo_city            VARCHAR(50),
    integrity_hash      VARCHAR(64),
    prev_hash           VARCHAR(64),
    PRIMARY KEY (log_id, timestamp),
    INDEX idx_audit_time (timestamp),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action_type),
    INDEX idx_audit_target (target_type, target_id),
    INDEX idx_audit_ip (request_ip),
    INDEX idx_audit_result (result),
    FULLTEXT idx_audit_ft (username, nickname, target_name, action_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(timestamp)) (
    PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
    PARTITION p202608 VALUES LESS THAN (TO_DAYS('2026-09-01')),
    PARTITION p202609 VALUES LESS THAN (TO_DAYS('2026-10-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 角色表
CREATE TABLE roles (
    role_id             INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    code                VARCHAR(50) NOT NULL,
    description         TEXT,
    is_system           TINYINT(1) DEFAULT 0,
    permissions         JSON DEFAULT ('[]') COMMENT 'JSON: ["repo:create","repo:edit",...]',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 部门表
CREATE TABLE departments (
    dept_id             INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    code                VARCHAR(50) NOT NULL,
    parent_id           INT DEFAULT NULL,
    sort_order          INT DEFAULT 1,
    leader              VARCHAR(100),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dept_code (code),
    INDEX idx_dept_parent (parent_id),
    CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES departments(dept_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户扩展表（关联 Gitea 用户）
CREATE TABLE user_profiles (
    user_id             INT PRIMARY KEY COMMENT '对应 Gitea user ID',
    gitea_username      VARCHAR(100) NOT NULL,
    nickname            VARCHAR(100),
    department_id       INT,
    role_code           VARCHAR(50),
    is_active           TINYINT(1) DEFAULT 1,
    last_login_at       DATETIME,
    login_failures      INT DEFAULT 0,
    locked_until        DATETIME,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gitea_username (gitea_username),
    INDEX idx_profile_dept (department_id),
    INDEX idx_profile_role (role_code),
    CONSTRAINT fk_profile_dept FOREIGN KEY (department_id) REFERENCES departments(dept_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通知表
CREATE TABLE notifications (
    notification_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    type                VARCHAR(20) NOT NULL,
    title               VARCHAR(200),
    content             TEXT,
    related_type        VARCHAR(30),
    related_id          INT,
    is_read             TINYINT(1) DEFAULT 0,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user (user_id, is_read),
    INDEX idx_notif_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 风险预警表
CREATE TABLE risk_warnings (
    warning_id          INT AUTO_INCREMENT PRIMARY KEY,
    level               VARCHAR(10) NOT NULL COMMENT 'critical/high/medium/low',
    type                VARCHAR(30) NOT NULL,
    title               VARCHAR(200),
    description         TEXT,
    related_user_id     INT,
    related_username    VARCHAR(100),
    source_ip           VARCHAR(45),
    triggered_rule      VARCHAR(50),
    triggered_value     DECIMAL(10,2),
    rule_threshold      DECIMAL(10,2),
    status              VARCHAR(20) DEFAULT 'unhandled',
    handler_user_id     INT,
    handler_comment     TEXT,
    handled_at          DATETIME,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_warn_status (status),
    INDEX idx_warn_level (level),
    INDEX idx_warn_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 报表记录表
CREATE TABLE reports (
    report_id           INT AUTO_INCREMENT PRIMARY KEY,
    template_id         INT NOT NULL,
    name                VARCHAR(200),
    format              VARCHAR(10) NOT NULL,
    status              VARCHAR(20) DEFAULT 'generating',
    parameters          JSON DEFAULT ('{}'),
    file_size           BIGINT,
    file_path           VARCHAR(500),
    download_url        VARCHAR(500),
    created_by          INT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    expire_at           DATETIME,
    INDEX idx_reports_status (status),
    INDEX idx_reports_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 备份记录表
CREATE TABLE backups (
    backup_id           INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(200),
    type                VARCHAR(10) DEFAULT 'manual',
    scope               VARCHAR(20) DEFAULT 'full',
    status              VARCHAR(20),
    progress            INT DEFAULT 0,
    file_size           BIGINT,
    storage_path        VARCHAR(500),
    checksum_sha256     VARCHAR(64),
    start_time          DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time            DATETIME,
    created_by          VARCHAR(100),
    INDEX idx_backups_status (status),
    INDEX idx_backups_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5.3 openGauss 与麒麟系统适配要点

| 方面 | 说明 |
|------|------|
| **安装方式** | openGauss 5.0 官方提供 ARM64/aarch64 安装包，麒麟 V10 原生支持，通过 `gs_install` 或容器化部署 |
| **客户端连接** | 使用 `gsql`（openGauss 自带）或标准 `psql`（PostgreSQL 兼容客户端），兼容 `pgAdmin`、`DBeaver` 等管理工具 |
| **驱动机理** | Node.js 使用 `pg` (node-postgres) 驱动，knex 设置 `client: 'pg'`，底层通过 PostgreSQL wire protocol 通信 |
| **字符集** | 强制 UTF-8 编码，LC_COLLATE='C' 或 'zh_CN.UTF-8'，支持中文全文检索 |
| **存储引擎** | UStore（openGauss 默认引擎），支持 MVCC、事务 ACID、行级锁 |
| **分区策略** | `audit_logs` 表使用 PostgreSQL 声明式分区（PARTITION BY RANGE），按月分区 |
| **备份** | `gs_dump` / `gs_restore` 逻辑备份，`gs_basebackup` 物理全量备份 + WAL 增量备份 |
| **高可用** | 主备复制 + `gs_om` 管理工具自动故障切换，可扩展至 1主多备 拓扑 |
| **JSONB 查询** | `->` / `->>` / `@>` / `?` 操作符，`jsonb_set()` / `jsonb_array_elements()` 等函数 |
| **安全特性** | 全密态等值查询、动态数据脱敏、行级安全策略（RLS）、审计日志内置 |

### 5.4 DDL 语法差异说明

设计文档中的 DDL 为 MariaDB/MySQL 语法，实际项目中需按以下规则转换为 openGauss/PostgreSQL 语法：

| 转换项 | MariaDB | openGauss/PostgreSQL |
|--------|---------|---------------------|
| 自增主键 | `INT AUTO_INCREMENT PRIMARY KEY` | `SERIAL PRIMARY KEY` |
| 布尔值 | `TINYINT(1) DEFAULT 0` | `BOOLEAN DEFAULT FALSE` |
| 时间戳 | `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |
| JSON | `JSON DEFAULT ('{}')` | `JSONB DEFAULT '{}'` |
| 自动更新 | `ON UPDATE CURRENT_TIMESTAMP` | 需触发器实现 |
| 唯一约束 | `UNIQUE KEY uk_name (col)` | `UNIQUE (col)` 或 `CONSTRAINT uk_name UNIQUE (col)` |
| 全文索引 | `FULLTEXT idx_ft (cols)` | `CREATE INDEX ON table USING GIN (to_tsvector('chinese', cols))` |
| 存储引擎 | `ENGINE=InnoDB` | 移除（使用 UStore） |
| 字符集 | `CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` | 移除（数据库级 UTF-8） |
| 分区语法 | `PARTITION BY RANGE (TO_DAYS(col))` | `PARTITION BY RANGE (col)` + 子表 |

### 5.5 数据库字段命名说明

项目中实际数据库字段命名遵循简洁风格，与设计文档中使用的描述性命名存在差异。后端 BFF 代码需适配实际数据库字段名。

---

## 6. BFF 层技术方案

### 6.1 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | **Node.js 20 LTS** | 长期支持版本 |
| 框架 | **Express** | 实际项目使用 Express，灵活轻量 |
| ORM | **Knex.js** | Knex 对 PostgreSQL/openGauss 兼容成熟，支持原生 SQL 与迁移管理 |
| 数据库 | **openGauss 5.0** | 信创名录推荐，PostgreSQL 协议兼容，全密态计算等安全特性 |
| Node.js 驱动 | **pg** (node-postgres) | PostgreSQL 协议驱动，openGauss 兼容，支持 Promise API |
| 缓存 | **Redis 7** | 会话管理、权限缓存、限流计数器（麒麟兼容版或自编译） |
| 文件存储 | **MinIO** | S3 兼容对象存储，归档文件存储，支持麒麟 ARM64 |
| 定时任务 | **node-cron** + **BullMQ** | 备份调度、报表生成、完整性校验 |
| PDF 生成 | **Puppeteer** + **handlebars** | HTML 模板渲染 → PDF |
| Excel 生成 | **exceljs** | 流式 Excel 生成 |
| 日志 | **pino** | 结构化日志 |
| 认证 | Gitea API Token 验证 | BFF 不存储密码，转发 Gitea 认证 |
| 加密 | **node:crypto** (AES-256-GCM) | 涉密数据加密存储 |

### 6.2 中间件架构

```
请求 → 限流中间件 → 认证中间件 → 审计日志中间件 → 权限校验中间件 → 部门隔离中间件 → 业务处理
```

| 中间件 | 职责 |
|--------|------|
| **RateLimiter** | 基于 Redis 的令牌桶限流，全局 + 按用户/IP |
| **AuthMiddleware** | 从 Header 提取 Token，向 Gitea 验证有效性，注入 userId 和 role |
| **AuditMiddleware** | 异步记录请求/响应到审计日志表（不阻塞主流程） |
| **PermissionMiddleware** | 根据路由权限配置 + 用户角色验证 |
| **DeptIsolationMiddleware** | 对跨部门查询自动注入 `WHERE department_id = ?` 条件 |

### 6.3 BFF 路由规划

```
/api/bff/
├── /version-rules          # 版本编号规则引擎 (4.1)
├── /approval-flows         # 审批流程模板 (4.2.1)
├── /approvals              # 审批申请 (4.2.2)
├── /compliance             # 合规审批 (4.2.3)
├── /baselines              # 基线管理 (4.3.1)
├── /archives               # 归档管理 (4.3.2)
├── /version-deprecations   # 版本废弃 (4.4)
├── /roles                  # 角色管理 (4.5.1)
├── /permissions            # 权限定义 (4.5.2)
├── /departments            # 部门管理 (4.5.3)
├── /sessions               # 会话管理 (4.5.4)
├── /audit                  # 审计日志 (4.6)
├── /reports                # 审计报表 (4.7)
├── /backups                # 备份管理 (4.8.1)
├── /integrity              # 完整性校验 (4.8.2)
├── /risk-warnings          # 风险预警 (4.9)
├── /notifications          # 通知系统 (4.10)
├── /system                 # 系统配置 (4.11)
└── /statistics             # 统计看板 (4.12)
```

### 6.4 BFF 接口统计

| 模块 | 接口数 |
|------|:------:|
| 版本编号引擎 | 4 |
| 审批流程引擎 | 19 |
| 基线归档管理 | 10 |
| 版本废弃管理 | 3 |
| 权限身份管控 | 16 |
| 审计日志系统 | 5 |
| 合规审计报表 | 5 |
| 安全与备份管理 | 10 |
| 风险监控预警 | 4 |
| 通知系统 | 4 |
| 系统配置管理 | 2 |
| 统计看板 | 2 |
| **合计** | **84** |

---

## 附录 A: 前端已实现 vs BFF 待实现对照表

| 分类 | 前端已实现 (Gitea API) | BFF 待实现 |
|------|------------------------|------------|
| 仓库 | 列表/创建/详情/删除/克隆 | 仓库统计/涉密标记 |
| 分支 | 列表/创建/删除/全局概览 | 分支保护策略/异地审批 |
| 版本 | 列表/创建/下载 | 编号规则/废弃/基线/归档 |
| PR | 列表/创建/详情/合并/关闭 | 审批联动/冲突检测 |
| 用户 | 列表/创建/编辑/删除 | RBAC/部门/会话管理 |
| 安全 | Gitea 原生 Token | 全量审计/防篡改/水印/备份 |
| 报表 | - | 全部报表功能 |
| 审批 | - | 全部审批功能 |
| 监控 | - | 全部预警功能 |
