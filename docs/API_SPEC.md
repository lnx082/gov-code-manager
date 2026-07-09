# 党政软件版本管控平台 — 后端 API 接口规范

> 本文档定义 Gitea 原生 API **不提供**、需独立后端实现的全部接口。
> 基础路径：`/api/v1`

---

## 目录

1. [审批管理](#1-审批管理-approval)
2. [审计日志](#2-审计日志-audit)
3. [角色权限管理](#3-角色权限管理-role)
4. [部门管理](#4-部门管理-department)
5. [基线管理](#5-基线管理-baseline)
6. [归档管理](#6-归档管理-archive)
7. [备份管理](#7-备份管理-backup)
8. [系统设置](#8-系统设置-settings)
9. [通知系统](#9-通知系统-notification)
10. [统计看板](#10-统计看板-statistics)

---

## 1. 审批管理 (Approval)

### 1.1 获取待审批列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Pending Approvals |
| **中文名称** | 获取待我审批列表 |
| **路径** | `GET /api/v1/approvals/pending` |
| **描述** | 查询当前用户需要审批的所有待办事项（合并请求、版本发布、基线申请等） |

**请求参数（Query）：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码，默认 1 |
| `pageSize` | integer | 否 | 每页条数，默认 10 |
| `type` | string | 否 | 审批类型：`merge` / `version` / `baseline` |
| `urgency` | string | 否 | 紧急程度：`high` / `normal` / `low` |

**返回数据：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "type": "merge",
        "title": "[feature/notification] 新增消息通知模块",
        "description": "本次合并新增了站内消息通知功能...",
        "applicant": {
          "id": 1001,
          "username": "zhangsan",
          "nickname": "张三",
          "department": "技术部"
        },
        "repoOwner": "besti",
        "repoName": "gov-user-service",
        "sourceBranch": "feature/notification",
        "targetBranch": "develop",
        "urgency": "normal",
        "approvalFlowId": 1,
        "approvalFlowName": "标准审批流程",
        "progress": 50,
        "approvals": 1,
        "requiredApprovals": 2,
        "createTime": "2026-07-08 10:00:00"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 1.2 获取我的申请列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get My Applications |
| **中文名称** | 获取我的申请列表 |
| **路径** | `GET /api/v1/approvals/my-applications` |
| **描述** | 查询当前用户提交的所有审批申请 |

**请求参数（Query）：** 同 1.1，增加 `status`（`pending`/`approved`/`rejected`）

**返回数据：** 结构同 1.1

---

### 1.3 获取审批详情

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Approval Detail |
| **中文名称** | 获取审批详情 |
| **路径** | `GET /api/v1/approvals/:approvalId` |
| **描述** | 查看某个审批申请的完整信息，包括审批记录、文件变更、评论 |

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `approvalId` | integer | 审批单 ID |

**返回数据：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "type": "merge",
    "title": "[feature/notification] 新增消息通知模块",
    "description": "详细描述...",
    "repoOwner": "besti",
    "repoName": "gov-user-service",
    "sourceBranch": "feature/notification",
    "targetBranch": "develop",
    "giteaPRNumber": 12,
    "additions": 150,
    "deletions": 20,
    "fileChanges": 8,
    "files": [
      { "path": "src/service/notification.js", "status": "modified", "additions": 80, "deletions": 5 }
    ],
    "applicant": { "id": 1001, "username": "zhangsan", "nickname": "张三" },
    "approvalFlow": { "id": 1, "name": "标准审批流程", "steps": 2 },
    "approvalRecords": [
      {
        "id": 1,
        "reviewer": { "id": 1002, "username": "lisi", "nickname": "李四" },
        "status": "approved",
        "comment": "代码质量良好，通过",
        "time": "2026-07-08 11:00:00"
      }
    ],
    "status": "pending",
    "createTime": "2026-07-08 10:00:00"
  }
}
```

---

### 1.4 提交审批操作

| 字段 | 值 |
|------|-----|
| **接口名称** | Handle Approval |
| **中文名称** | 处理审批（通过/拒绝） |
| **路径** | `POST /api/v1/approvals/:approvalId/:action` |
| **描述** | 审批人对审批单进行操作 |

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `approvalId` | integer | 审批单 ID |
| `action` | string | `approve`（通过）/ `reject`（拒绝） |

**请求体：**

```json
{
  "comment": "审批意见（可选）"
}
```

**返回数据：**

```json
{
  "code": 200,
  "message": "审批通过",
  "data": { "newStatus": "approved", "approvalTime": "2026-07-08 14:00:00" }
}
```

---

### 1.5 撤回申请

| 字段 | 值 |
|------|-----|
| **接口名称** | Withdraw Application |
| **中文名称** | 撤回审批申请 |
| **路径** | `POST /api/v1/approvals/:approvalId/withdraw` |
| **描述** | 申请人撤回自己提交的审批申请（仅在审批未完成时可用） |

**返回数据：** `{ "code": 200, "message": "撤回成功" }`

---

### 1.6 获取审批历史

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Approval History |
| **中文名称** | 获取审批历史记录 |
| **路径** | `GET /api/v1/approvals/history` |
| **描述** | 查询所有已完成/已关闭的审批记录 |

**请求参数（Query）：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `type` | string | 否 | 审批类型 |
| `status` | string | 否 | `approved` / `rejected` / `withdrawn` |
| `dateRange` | array | 否 | 时间范围 `["2026-07-01","2026-07-08"]` |
| `keyword` | string | 否 | 标题关键词搜索 |

**返回数据：** 结构同 1.1，`status` 字段为最终结果

---

### 1.7 审批流程 CRUD

#### 1.7.1 获取审批流程列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Approval Processes |
| **中文名称** | 获取审批流程列表 |
| **路径** | `GET /api/v1/approvals/processes` |
| **描述** | 获取系统中配置的审批流程模板 |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "标准审批流程",
      "description": "适用于普通合并请求和版本发布",
      "steps": [
        { "order": 1, "requiredRole": "project_manager", "requiredCount": 1 },
        { "order": 2, "requiredRole": "admin", "requiredCount": 1 }
      ],
      "isDefault": true,
      "createTime": "2026-01-01"
    }
  ]
}
```

#### 1.7.2 创建审批流程

| 字段 | 值 |
|------|-----|
| **接口名称** | Create Approval Process |
| **中文名称** | 创建审批流程 |
| **路径** | `POST /api/v1/approvals/processes` |
| **权限** | `admin:manage` |

#### 1.7.3 更新审批流程

| 字段 | 值 |
|------|-----|
| **接口名称** | Update Approval Process |
| **中文名称** | 更新审批流程 |
| **路径** | `PUT /api/v1/approvals/processes/:processId` |

#### 1.7.4 删除审批流程

| 字段 | 值 |
|------|-----|
| **接口名称** | Delete Approval Process |
| **中文名称** | 删除审批流程 |
| **路径** | `DELETE /api/v1/approvals/processes/:processId` |

---

### 1.8 创建审批申请

| 字段 | 值 |
|------|-----|
| **接口名称** | Create Approval Request |
| **中文名称** | 创建审批申请 |
| **路径** | `POST /api/v1/approvals` |
| **描述** | 当用户创建合并请求、发布版本或申请基线时，前端先调用此接口创建审批单 |

**请求体：**

```json
{
  "type": "merge",
  "title": "[feature/xxx] 新增功能",
  "description": "详细描述...",
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "sourceBranch": "feature/xxx",
  "targetBranch": "develop",
  "giteaPRNumber": 12,
  "approvalFlowId": 1,
  "urgency": "normal",
  "reviewers": ["lisi", "wangwu"]
}
```

**返回数据：**

```json
{
  "code": 200,
  "message": "审批申请已提交",
  "data": { "approvalId": 1, "status": "pending" }
}
```

---

## 2. 审计日志 (Audit)

### 2.1 获取操作日志列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Audit Logs |
| **中文名称** | 获取操作日志列表 |
| **路径** | `GET /api/v1/audit/logs` |
| **描述** | 查询系统操作日志，支持多维度筛选 |
| **权限** | `audit:view` |

**请求参数（Query）：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数，默认 20 |
| `username` | string | 否 | 操作用户名 |
| `actionType` | string | 否 | 操作类型：`login`/`commit`/`merge`/`version`/`download`/`delete`/`create`/`update` |
| `target` | string | 否 | 操作对象（仓库名/版本号等） |
| `startDate` | string | 否 | 开始日期 `2026-07-01` |
| `endDate` | string | 否 | 结束日期 |
| `result` | string | 否 | 结果：`success` / `failure` |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "LOG-2026-0001",
        "timestamp": "2026-07-08 10:30:25",
        "username": "zhangsan",
        "nickname": "张三",
        "role": "开发人员",
        "actionType": "commit",
        "target": "besti/gov-user-service",
        "targetType": "repository",
        "description": "提交代码到 feature/auth 分支",
        "ip": "192.168.1.100",
        "userAgent": "git/2.39.0",
        "result": "success",
        "duration": 2300,
        "details": {
          "branch": "feature/auth",
          "commitSha": "a1b2c3d4e5f6",
          "files": 3,
          "additions": 150,
          "deletions": 20
        }
      }
    ],
    "total": 1256,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 2.2 获取日志详情

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Audit Log Detail |
| **中文名称** | 获取日志详情 |
| **路径** | `GET /api/v1/audit/logs/:logId` |
| **描述** | 查看单条审计日志的完整信息 |

---

### 2.3 导出日志

| 字段 | 值 |
|------|-----|
| **接口名称** | Export Audit Logs |
| **中文名称** | 导出审计日志 |
| **路径** | `GET /api/v1/audit/logs/export` |
| **描述** | 将筛选后的日志导出为 Excel/CSV 文件 |

**请求参数：** 同 2.1，增加 `format`（`xlsx` / `csv`）

**返回数据：** `Content-Type: application/octet-stream` 文件二进制流

---

### 2.4 获取风险预警列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Risk Warnings |
| **中文名称** | 获取风险预警列表 |
| **路径** | `GET /api/v1/audit/warnings` |
| **描述** | 获取安全风险预警信息 |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "level": "warning",
      "title": "异常登录：IP 192.168.1.100 多次登录失败",
      "description": "用户 zhangsan 在 5 分钟内登录失败 10 次",
      "relatedUser": "zhangsan",
      "sourceIP": "192.168.1.100",
      "status": "unhandled",
      "createTime": "2026-07-08 10:00:00"
    }
  ]
}
```

---

### 2.5 处理/忽略风险预警

| 字段 | 值 |
|------|-----|
| **接口名称** | Handle / Ignore Risk Warning |
| **中文名称** | 处理/忽略风险预警 |
| **路径** | `POST /api/v1/audit/warnings/:warningId/handle` |
| | `POST /api/v1/audit/warnings/:warningId/ignore` |

**请求体：**

```json
{
  "comment": "已确认，误报"
}
```

---

### 2.6 审计报表

#### 2.6.1 获取报表列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Audit Reports |
| **中文名称** | 获取审计报表列表 |
| **路径** | `GET /api/v1/audit/reports` |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "2026年7月操作审计月报",
      "type": "monthly",
      "period": "2026-07",
      "fileSize": "2.3MB",
      "createdBy": "系统管理员",
      "createTime": "2026-07-01 00:00:00"
    }
  ]
}
```

#### 2.6.2 生成审计报表

| 字段 | 值 |
|------|-----|
| **接口名称** | Generate Audit Report |
| **中文名称** | 生成审计报表 |
| **路径** | `POST /api/v1/audit/reports/generate` |

**请求体：**

```json
{
  "name": "2026年7月操作审计月报",
  "type": "monthly",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "includeModules": ["login", "commit", "merge", "version", "admin"]
}
```

#### 2.6.3 下载报表

| 字段 | 值 |
|------|-----|
| **接口名称** | Download Report |
| **中文名称** | 下载审计报表 |
| **路径** | `GET /api/v1/audit/reports/:reportId/download` |
| **返回数据**：文件流 |

#### 2.6.4 删除报表

| 字段 | 值 |
|------|-----|
| **接口名称** | Delete Report |
| **中文名称** | 删除审计报表 |
| **路径** | `DELETE /api/v1/audit/reports/:reportId` |

---

### 2.7 获取审计统计数据

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Audit Stats |
| **中文名称** | 获取审计统计数据 |
| **路径** | `GET /api/v1/audit/stats` |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "totalLogs": 12560,
    "todayLogs": 230,
    "loginCount": 45,
    "commitCount": 89,
    "mergeCount": 12,
    "downloadCount": 34,
    "failedLogins": 3,
    "riskWarnings": 2,
    "unhandledRisks": 1
  }
}
```

---

## 3. 角色权限管理 (Role)

### 3.1 获取角色列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Role List |
| **中文名称** | 获取角色列表 |
| **路径** | `GET /api/v1/admin/roles` |
| **权限** | `admin:manage` |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "系统管理员",
      "code": "admin",
      "description": "拥有系统全部权限",
      "userCount": 2,
      "permissions": ["*"],
      "createTime": "2026-01-01"
    },
    {
      "id": 2,
      "name": "项目管理员",
      "code": "project_manager",
      "description": "管理所辖项目的仓库和人员",
      "userCount": 5,
      "permissions": ["repo:create", "repo:edit", "repo:delete", "branch:create", "tag:create", "member:manage"],
      "createTime": "2026-01-01"
    },
    {
      "id": 3,
      "name": "开发人员",
      "code": "developer",
      "description": "日常代码开发权限",
      "userCount": 20,
      "permissions": ["repo:download", "branch:create", "tag:create"],
      "createTime": "2026-01-01"
    }
  ]
}
```

---

### 3.2 获取角色详情

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Role Detail |
| **中文名称** | 获取角色详情（含权限树） |
| **路径** | `GET /api/v1/admin/roles/:roleId` |

---

### 3.3 创建角色

| 字段 | 值 |
|------|-----|
| **接口名称** | Create Role |
| **中文名称** | 创建角色 |
| **路径** | `POST /api/v1/admin/roles` |

**请求体：**

```json
{
  "name": "审计人员",
  "code": "auditor",
  "description": "拥有审计日志和报表查看权限",
  "permissions": ["audit:view", "repo:download"]
}
```

---

### 3.4 更新角色

| 字段 | 值 |
|------|-----|
| **接口名称** | Update Role |
| **中文名称** | 更新角色信息 |
| **路径** | `PUT /api/v1/admin/roles/:roleId` |

---

### 3.5 删除角色

| 字段 | 值 |
|------|-----|
| **接口名称** | Delete Role |
| **中文名称** | 删除角色 |
| **路径** | `DELETE /api/v1/admin/roles/:roleId` |

---

### 3.6 获取角色权限

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Role Permissions |
| **中文名称** | 获取角色权限列表 |
| **路径** | `GET /api/v1/admin/roles/:roleId/permissions` |

---

### 3.7 更新角色权限

| 字段 | 值 |
|------|-----|
| **接口名称** | Update Role Permissions |
| **中文名称** | 更新角色权限 |
| **路径** | `PUT /api/v1/admin/roles/:roleId/permissions` |

**请求体：**

```json
{
  "permissions": [
    "repo:download",
    "repo:create",
    "branch:create",
    "branch:delete",
    "tag:create",
    "audit:view"
  ]
}
```

---

### 3.8 权限常量定义

```json
{
  "allPermissions": [
    { "key": "*",            "name": "超级管理员",   "group": "系统" },
    { "key": "repo:create",  "name": "创建仓库",     "group": "仓库管理" },
    { "key": "repo:edit",    "name": "编辑仓库",     "group": "仓库管理" },
    { "key": "repo:delete",  "name": "删除仓库",     "group": "仓库管理" },
    { "key": "repo:download","name": "下载仓库",     "group": "仓库管理" },
    { "key": "branch:create","name": "创建分支",     "group": "分支管理" },
    { "key": "branch:delete","name": "删除分支",     "group": "分支管理" },
    { "key": "branch:protect","name":"保护分支",     "group": "分支管理" },
    { "key": "tag:create",   "name": "创建版本",     "group": "版本管理" },
    { "key": "tag:delete",   "name": "删除版本",     "group": "版本管理" },
    { "key": "baseline:manage","name":"基线管理",    "group": "版本管理" },
    { "key": "approval:approve","name":"审批操作",   "group": "审批管理" },
    { "key": "approval:config","name":"配置审批流程","group": "审批管理" },
    { "key": "audit:view",   "name": "查看审计",     "group": "审计管理" },
    { "key": "audit:export", "name": "导出审计",     "group": "审计管理" },
    { "key": "admin:manage", "name": "系统管理",     "group": "系统管理" },
    { "key": "member:manage","name": "成员管理",     "group": "系统管理" },
    { "key": "backup:manage","name": "备份管理",     "group": "系统管理" }
  ]
}
```

---

## 4. 部门管理 (Department)

### 4.1 获取部门树

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Department Tree |
| **中文名称** | 获取部门组织架构树 |
| **路径** | `GET /api/v1/admin/depts` |
| **权限** | `admin:manage` |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "信息化建设办公室",
      "code": "info_office",
      "parentId": 0,
      "sort": 1,
      "leader": "张主任",
      "userCount": 15,
      "children": [
        {
          "id": 2,
          "name": "技术研发部",
          "code": "tech_dept",
          "parentId": 1,
          "sort": 1,
          "leader": "李部长",
          "userCount": 8,
          "children": []
        },
        {
          "id": 3,
          "name": "网络运维部",
          "code": "ops_dept",
          "parentId": 1,
          "sort": 2,
          "leader": "王部长",
          "userCount": 5,
          "children": []
        },
        {
          "id": 4,
          "name": "信息安全部",
          "code": "sec_dept",
          "parentId": 1,
          "sort": 3,
          "leader": "赵部长",
          "userCount": 2,
          "children": []
        }
      ]
    }
  ]
}
```

---

### 4.2 创建部门

| 字段 | 值 |
|------|-----|
| **接口名称** | Create Department |
| **中文名称** | 创建部门 |
| **路径** | `POST /api/v1/admin/depts` |

**请求体：**

```json
{
  "name": "技术研发部",
  "code": "tech_dept",
  "parentId": 1,
  "leader": "李部长",
  "sort": 1
}
```

**返回数据：**

```json
{
  "code": 200,
  "message": "部门创建成功",
  "data": { "deptId": 2 }
}
```

---

### 4.3 更新部门

| 字段 | 值 |
|------|-----|
| **接口名称** | Update Department |
| **中文名称** | 更新部门信息 |
| **路径** | `PUT /api/v1/admin/depts/:deptId` |

---

### 4.4 删除部门

| 字段 | 值 |
|------|-----|
| **接口名称** | Delete Department |
| **中文名称** | 删除部门 |
| **路径** | `DELETE /api/v1/admin/depts/:deptId` |
| **说明** |  如果部门下有用户，不允许删除，需先迁移用户 |

---

## 5. 基线管理 (Baseline)

### 5.1 获取基线列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Baseline List |
| **中文名称** | 获取基线版本列表 |
| **路径** | `GET /api/v1/versions/baseline` |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "repoOwner": "besti",
      "repoName": "gov-user-service",
      "tagName": "v2.0.0",
      "tagSha": "a1b2c3d4e5f6a7b8c9d0e1f2",
      "name": "V2.0 正式基线",
      "description": "V2.0 版本通过全部测试和审批，设为基线版本",
      "type": "release",
      "status": "active",
      "approvedBy": "李四",
      "approvalId": 15,
      "lockedAt": "2026-06-15 10:00:00",
      "createdBy": "张三",
      "createTime": "2026-06-10 09:00:00"
    }
  ]
}
```

---

### 5.2 申请基线

| 字段 | 值 |
|------|-----|
| **接口名称** | Apply Baseline |
| **中文名称** | 申请将版本设为基线 |
| **路径** | `POST /api/v1/versions/baseline/apply` |

**请求体：**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "tagName": "v2.0.0",
  "name": "V2.0 正式基线",
  "description": "通过全部测试和审批，申请设为基线",
  "type": "release",
  "approvalFlowId": 2
}
```

**返回数据：**

```json
{
  "code": 200,
  "message": "基线申请已提交，等待审批",
  "data": { "baselineId": 1, "approvalId": 15 }
}
```

---

### 5.3 锁定/解锁基线

| 字段 | 值 |
|------|-----|
| **接口名称** | Lock / Unlock Baseline |
| **中文名称** | 锁定/解锁基线版本 |
| **路径** | `POST /api/v1/versions/baseline/:baselineId/lock` |
| | `POST /api/v1/versions/baseline/:baselineId/unlock` |
| **描述** | 锁定后的基线版本不可删除、不可覆盖 |

---

### 5.4 基线对比

| 字段 | 值 |
|------|-----|
| **接口名称** | Compare Baselines |
| **中文名称** | 基线版本对比 |
| **路径** | `GET /api/v1/versions/baseline/compare` |
| **请求参数** | `sourceId` / `targetId` 两个基线 ID |
| **返回数据** | 两个基线之间的差异信息（新增/修改/删除的文件列表） |

---

## 6. 归档管理 (Archive)

### 6.1 获取归档列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Archive List |
| **中文名称** | 获取归档版本列表 |
| **路径** | `GET /api/v1/versions/archive` |

**返回数据：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "repoOwner": "besti",
      "repoName": "gov-user-service",
      "tagName": "v1.0.0",
      "archiveName": "v1.0.0.tar.gz",
      "fileSize": "45.2 MB",
      "sha256": "abc123...",
      "status": "archived",
      "archivedBy": "张三",
      "retentionDate": "2031-06-15",
      "archiveTime": "2026-06-15 14:00:00",
      "description": "V1.0 版本归档存储"
    }
  ]
}
```

---

### 6.2 创建归档

| 字段 | 值 |
|------|-----|
| **接口名称** | Create Archive |
| **中文名称** | 创建版本归档 |
| **路径** | `POST /api/v1/versions/archive` |

**请求体：**

```json
{
  "repoOwner": "besti",
  "repoName": "gov-user-service",
  "tagName": "v1.0.0",
  "description": "V1.0 版本归档存储",
  "retentionYears": 5
}
```

---

### 6.3 下载归档

| 字段 | 值 |
|------|-----|
| **接口名称** | Download Archive |
| **中文名称** | 下载归档文件 |
| **路径** | `GET /api/v1/versions/archive/:archiveId/download` |
| **返回**：文件流 |

---

### 6.4 删除归档

| 字段 | 值 |
|------|-----|
| **接口名称** | Delete Archive |
| **中文名称** | 删除归档 |
| **路径** | `DELETE /api/v1/versions/archive/:archiveId` |

---

### 6.5 还原归档

| 字段 | 值 |
|------|-----|
| **接口名称** | Restore Archive |
| **中文名称** | 从归档还原版本 |
| **路径** | `POST /api/v1/versions/archive/:archiveId/restore` |
| **描述** | 将归档的版本还原为可用状态 |

---

## 7. 备份管理 (Backup)

### 7.1 获取备份列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Backup List |
| **中文名称** | 获取备份列表 |
| **路径** | `GET /api/v1/admin/backup` |
| **权限** | `admin:manage` |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "name": "数据库备份_20260708_0200",
        "type": "auto",
        "scope": "full",
        "fileSize": "125.6 MB",
        "status": "completed",
        "progress": 100,
        "createdBy": "system",
        "startTime": "2026-07-08 02:00:00",
        "endTime": "2026-07-08 02:05:30",
        "duration": 330
      }
    ],
    "stats": {
      "totalBackups": 30,
      "totalSize": "3.8 GB",
      "lastBackup": "2026-07-08 02:00:00",
      "nextScheduledBackup": "2026-07-09 02:00:00"
    }
  }
}
```

---

### 7.2 创建备份

| 字段 | 值 |
|------|-----|
| **接口名称** | Create Backup |
| **中文名称** | 创建系统备份 |
| **路径** | `POST /api/v1/admin/backup` |

**请求体：**

```json
{
  "name": "手动备份_20260708",
  "scope": "full",
  "description": "版本更新前的手动备份"
}
```

**返回数据：**

```json
{
  "code": 200,
  "message": "备份任务已启动",
  "data": { "backupId": 31, "status": "running" }
}
```

---

### 7.3 恢复备份

| 字段 | 值 |
|------|-----|
| **接口名称** | Restore Backup |
| **中文名称** | 从备份恢复 |
| **路径** | `POST /api/v1/admin/backup/:backupId/restore` |

---

### 7.4 删除备份

| 字段 | 值 |
|------|-----|
| **接口名称** | Delete Backup |
| **中文名称** | 删除备份文件 |
| **路径** | `DELETE /api/v1/admin/backup/:backupId` |

---

### 7.5 下载备份

| 字段 | 值 |
|------|-----|
| **接口名称** | Download Backup |
| **中文名称** | 下载备份文件 |
| **路径** | `GET /api/v1/admin/backup/:backupId/download` |
| **返回**：文件流 |

---

### 7.6 获取/更新备份配置

| 字段 | 值 |
|------|-----|
| **接口名称** | Get / Update Backup Settings |
| **中文名称** | 获取/更新备份设置 |
| **路径** | `GET /api/v1/admin/backup/settings` |
| | `PUT /api/v1/admin/backup/settings` |

**GET 返回 / PUT 请求体：**

```json
{
  "autoBackup": true,
  "schedule": "0 2 * * *",
  "retentionDays": 30,
  "backupScope": "full",
  "storagePath": "/data/backups",
  "notifyOnFailure": true,
  "notifyEmail": "admin@gov.cn"
}
```

---

## 8. 系统设置 (Settings)

### 8.1 获取系统设置

| 字段 | 值 |
|------|-----|
| **接口名称** | Get System Settings |
| **中文名称** | 获取系统设置 |
| **路径** | `GET /api/v1/admin/settings` |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "systemName": "党政软件版本管控平台",
    "systemVersion": "1.0.0",
    "logoUrl": "/assets/logo.png",
    "loginBannerText": "欢迎使用党政软件版本管控平台",
    "securityNotice": "本系统处于安全监控下，请使用本人账号登录",
    "sessionTimeout": 480,
    "maxLoginAttempts": 5,
    "lockoutDuration": 30,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireDigit": true,
      "requireSpecial": false,
      "expireDays": 90
    },
    "ipWhitelist": [],
    "maintenanceMode": false,
    "maintenanceMessage": ""
  }
}
```

---

### 8.2 更新系统设置

| 字段 | 值 |
|------|-----|
| **接口名称** | Update System Settings |
| **中文名称** | 更新系统设置 |
| **路径** | `PUT /api/v1/admin/settings` |
| **权限** | `admin:manage` |

**请求体：** 与 8.1 返回结构相同，按需传部分字段

---

## 9. 通知系统 (Notification)

### 9.1 获取通知列表

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Notifications |
| **中文名称** | 获取通知列表 |
| **路径** | `GET /api/v1/notifications` |

**请求参数（Query）：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `read` | boolean | 否 | `true` 已读 / `false` 未读 |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "type": "approval",
        "title": "您有一条新的审批待办",
        "content": "张三 提交了合并请求审批：[feature/xxx] 新增消息通知模块",
        "relatedId": 1,
        "relatedType": "approval",
        "isRead": false,
        "createTime": "2026-07-08 10:00:00"
      }
    ],
    "total": 3,
    "unreadCount": 2
  }
}
```

---

### 9.2 标记通知已读

| 字段 | 值 |
|------|-----|
| **接口名称** | Mark Notification Read |
| **中文名称** | 标记通知为已读 |
| **路径** | `PUT /api/v1/notifications/:notificationId/read` |

---

### 9.3 全部标记已读

| 字段 | 值 |
|------|-----|
| **接口名称** | Mark All Read |
| **中文名称** | 全部标记已读 |
| **路径** | `PUT /api/v1/notifications/read-all` |

---

### 9.4 获取未读数量

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Unread Count |
| **中文名称** | 获取未读通知数量 |
| **路径** | `GET /api/v1/notifications/unread-count` |

**返回数据：**

```json
{
  "code": 200,
  "data": { "count": 2 }
}
```

---

## 10. 统计看板 (Statistics)

### 10.1 获取仪表盘统计

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Dashboard Stats |
| **中文名称** | 获取仪表盘统计数据 |
| **路径** | `GET /api/v1/statistics/dashboard` |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "repoCount": 24,
    "branchCount": 156,
    "tagCount": 89,
    "userCount": 35,
    "onlineUsers": 12,
    "pendingApprovals": 5,
    "todayCommits": 47,
    "todayMerges": 8,
    "recentActivities": [
      {
        "id": 1,
        "user": { "username": "zhangsan", "nickname": "张三" },
        "action": "commit",
        "description": "提交了代码到 gov-user-service",
        "target": "besti/gov-user-service",
        "time": "2026-07-08 10:30:00"
      }
    ],
    "repoStats": {
      "totalSize": "2.3 GB",
      "publicCount": 5,
      "privateCount": 19
    },
    "trendData": {
      "weeklyCommits": [12, 18, 15, 22, 19, 25, 8],
      "weeklyMerges": [3, 5, 2, 4, 6, 3, 1]
    }
  }
}
```

---

### 10.2 获取趋势数据

| 字段 | 值 |
|------|-----|
| **接口名称** | Get Trend Data |
| **中文名称** | 获取操作趋势数据（图表用） |
| **路径** | `GET /api/v1/statistics/trends` |

**请求参数（Query）：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|:---:|------|
| `startDate` | string | 是 | 开始日期 |
| `endDate` | string | 是 | 结束日期 |
| `granularity` | string | 否 | `day` / `week` / `month`，默认 `day` |

**返回数据：**

```json
{
  "code": 200,
  "data": {
    "commits": [
      { "date": "2026-07-01", "count": 12 },
      { "date": "2026-07-02", "count": 18 }
    ],
    "merges": [
      { "date": "2026-07-01", "count": 3 },
      { "date": "2026-07-02", "count": 5 }
    ],
    "downloads": [
      { "date": "2026-07-01", "count": 7 },
      { "date": "2026-07-02", "count": 4 }
    ],
    "logins": [
      { "date": "2026-07-01", "count": 25 },
      { "date": "2026-07-02", "count": 30 }
    ]
  }
}
```

---

## 附录 A：通用约定

### A.1 通用请求头

| Header | 值 | 说明 |
|--------|-----|------|
| `Content-Type` | `application/json` | 请求体格式 |
| `Authorization` | `token <sha1> 或 Basic <base64>` | 认证令牌 |

### A.2 通用响应格式

**成功：**
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

**分页成功：**
```json
{
  "code": 200,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

**错误：**
```json
{
  "code": 400,
  "message": "参数错误：xxx 不能为空",
  "data": null
}
```

### A.3 HTTP 状态码

| 状态码 | 说明 |
|:------:|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未认证（Token 无效或过期） |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突（如重复审批） |
| 500 | 服务器内部错误 |

### A.4 接口总数统计

| 模块 | 接口数量 |
|------|:--------:|
| 审批管理 | 12 |
| 审计日志 | 10 |
| 角色权限 | 7 |
| 部门管理 | 4 |
| 基线管理 | 5 |
| 归档管理 | 5 |
| 备份管理 | 6 |
| 系统设置 | 2 |
| 通知系统 | 4 |
| 统计看板 | 2 |
| **合计** | **57** |
