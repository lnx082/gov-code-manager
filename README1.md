# 党政软件版本管控平台

GovCode Version Control Platform — 面向党政机关的软件版本全生命周期管控系统。

---

## 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [功能特性](#功能特性)
4. [环境要求](#环境要求)
5. [第一步：安装 OpenGauss 数据库](#第一步安装-opengauss-数据库)
6. [第二步：安装 Gitea 代码托管平台](#第二步安装-gitea-代码托管平台)
7. [第三步：部署 BFF 后端服务](#第三步部署-bff-后端服务)
8. [第四步：部署前端应用](#第四步部署前端应用)
9. [Docker 一键部署](#docker-一键部署)
10. [配置说明](#配置说明)
11. [API 接口概览](#api-接口概览)
12. [项目目录结构](#项目目录结构)
13. [默认账号](#默认账号)
14. [常见问题](#常见问题)

---

## 项目概述

本平台基于 **Gitea** 代码托管 + **OpenGauss** 数据库 + **Node.js BFF 中间层** + **Vue 3 前端** 构建，实现党政机关软件版本的全生命周期管控，包括：

- 代码仓库管理（部门隔离、密级管控）
- 分支/版本/基线/归档管理
- 多级审批流程
- 全流程审计溯源
- 风险预警与合规检查

### 核心数据流

```
浏览器 (Vue 3)
    │
    ▼ HTTP /api/bff/*
Nginx (80) ──→ BFF (Node.js :8080)
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
  Gitea API   OpenGauss   审计日志链
  (:3000)     (:15432)    (防篡改)
```

---

## 技术架构

| 层级 | 技术 | 端口 |
|------|------|:---:|
| 前端 | Vue 3 + Element Plus + Vite | 5173 (dev) / 80 (prod) |
| BFF 中间层 | Node.js 18 + Express + Knex | 8080 |
| 代码仓库 | Gitea 1.22+ | 3000 |
| 数据库 | OpenGauss 5.0 (兼容 PostgreSQL) | 15432 |
| 反向代理 | Nginx (集成在前端容器中) | 80 |
| 容器化 | Docker + Docker Compose | — |

---

## 功能特性

### 核心功能

- **仓库管理** — 仓库创建/查看/删除，部门归属，密级管控（公开/秘密/机密/绝密）
- **分支管理** — 分支列表/创建/合并/删除，保护分支
- **版本管理** — 版本发布（tag/release），语义化版本号，下载 ZIP
- **基线管理** — 基线创建/变更/冻结/解冻，仓库只读锁定
- **归档管理** — 旧版本归档/下载，长期留存
- **审批流程** — 标准化多级审批，待审批/已审批/我的申请/历史
- **审计日志** — 全操作记录，防篡改哈希链，完整性校验
- **风险预警** — 异常登录/批量下载/敏感操作自动检测
- **合规检查** — 等保三级合规要求自动审计
- **备份恢复** — 数据库全量/增量备份，定时任务

### 角色权限

| 角色 | 权限范围 |
|------|----------|
| 系统管理员 (admin) | 全部权限，用户/角色/部门/备份/系统配置管理 |
| 项目管理员 (project_manager) | 仓库全生命周期管理，审批操作 |
| 开发人员 (developer) | 代码提交，分支/版本操作，申请审批 |
| 审计人员 (auditor) | 审计日志查看，报表下载，风险预警处理 |

---

## 环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| 操作系统 | CentOS 7+ / Ubuntu 20.04+ / openEuler 22.03+ / Kylin V10 | 信创环境推荐 openEuler/Kylin |
| CPU 架构 | x86_64 / ARM64 (鲲鹏) | — |
| 内存 | ≥ 8 GB | 含 Gitea + OpenGauss + Node.js |
| 磁盘 | ≥ 50 GB | 含代码仓库 + 数据库 |
| Node.js | ≥ 18.0.0 | BFF 运行时 |
| npm | ≥ 9.0.0 | 包管理器 |
| Docker | ≥ 20.10 (可选) | 容器化部署 |
| Docker Compose | ≥ 2.0 (可选) | 容器编排 |

---

## 第一步：安装 OpenGauss 数据库

### 1.1 下载安装包

从 openGauss 官网下载对应架构的安装包：

```bash
# x86_64 架构
wget https://opengauss.obs.cn-south-1.myhuaweicloud.com/5.0.0/x86_openEuler/openGauss-5.0.0-openEuler-64bit-all.tar.gz

# ARM64 架构（鲲鹏）
wget https://opengauss.obs.cn-south-1.myhuaweicloud.com/5.0.0/arm/openGauss-5.0.0-openEuler-64bit-all.tar.gz
```

### 1.2 解压并安装

```bash
# 解压
tar -xzf openGauss-5.0.0-openEuler-64bit-all.tar.gz
cd openGauss-5.0.0-openEuler-64bit-all

# 安装（需要 root 权限）
sudo ./install.sh

# 默认安装路径：/opt/software/openGauss
```

### 1.3 创建数据库用户和目录

```bash
# 创建 openGauss 管理用户
sudo groupadd dbgrp
sudo useradd -g dbgrp omm
sudo passwd omm

# 创建数据目录
sudo mkdir -p /opt/software/openGauss/data
sudo chown -R omm:dbgrp /opt/software/openGauss
```

### 1.4 初始化数据库

```bash
# 切换到 omm 用户
sudo su - omm

# 进入安装目录
cd /opt/software/openGauss

# 初始化数据库（单节点）
gs_initdb -D /opt/software/openGauss/data \
  --nodename=og1 \
  --encoding=UTF-8 \
  --locale=zh_CN.UTF-8 \
  --dbcompatibility=PG
```

### 1.5 配置监听和认证

编辑 `/opt/software/openGauss/data/postgresql.conf`：

```ini
listen_addresses = '0.0.0.0'
port = 15432
max_connections = 200
password_encryption_type = 1
```

编辑 `/opt/software/openGauss/data/pg_hba.conf`，在末尾添加：

```
# 允许所有主机通过密码连接
host    all    all    0.0.0.0/0    sha256
```

### 1.6 启动数据库

```bash
# 启动
gs_ctl start -D /opt/software/openGauss/data

# 检查状态
gs_ctl status -D /opt/software/openGauss/data
```

### 1.7 创建业务数据库和用户

```bash
# 连接数据库
gsql -d postgres -p 15432

-- 创建业务用户
CREATE USER dev_admin WITH PASSWORD 'Besti@2026_db';
ALTER USER dev_admin SYSADMIN;

-- 创建业务数据库
CREATE DATABASE gov_code_manager OWNER dev_admin ENCODING 'UTF-8';
GRANT ALL PRIVILEGES ON DATABASE gov_code_manager TO dev_admin;

-- 退出
\q
```

### 1.8 验证连接

```bash
# 用业务用户连接
gsql -d gov_code_manager -U dev_admin -p 15432 -W

# 输入密码后应看到：
# gov_code_manager=>
```

---

## 第二步：安装 Gitea 代码托管平台

### 2.1 下载 Gitea

```bash
# 创建运行用户
sudo useradd -m -s /bin/bash git

# 下载 Gitea 二进制文件（x86_64）
sudo wget -O /usr/local/bin/gitea \
  https://dl.gitea.com/gitea/1.22.6/gitea-1.22.6-linux-amd64

# ARM64 架构（鲲鹏）
# sudo wget -O /usr/local/bin/gitea \
#   https://dl.gitea.com/gitea/1.22.6/gitea-1.22.6-linux-arm64

# 设置权限
sudo chmod +x /usr/local/bin/gitea
```

### 2.2 创建目录结构

```bash
sudo mkdir -p /home/git/gitea/{custom,data,log}
sudo chown -R git:git /home/git/gitea
sudo chmod -R 750 /home/git/gitea
```

### 2.3 配置 Gitea

编辑 `/home/git/gitea/custom/conf/app.ini`：

```ini
APP_NAME = 党政软件版本管控平台
RUN_MODE = prod
RUN_USER = git

[server]
PROTOCOL = http
DOMAIN = 123.60.219.19#gitea和服务器地址
HTTP_PORT = 3000
ROOT_URL = http://123.60.219.19:3000#同上
LFS_START_SERVER = true
OFFLINE_MODE = true

[database]
DB_TYPE = sqlite3
PATH = /home/git/gitea/data/gitea.db

[repository]
ROOT = /home/git/gitea/data/gitea-repositories
DEFAULT_PRIVATE = private

[security]
INSTALL_LOCK = true
SECRET_KEY = <生成随机密钥>

[service]
DISABLE_REGISTRATION = true
REQUIRE_SIGNIN_VIEW = true

[api]
ENABLE_SWAGGER = true
MAX_RESPONSE_ITEMS = 200

[admin]
DEFAULT_ADMIN_USERNAME = root
DEFAULT_ADMIN_EMAIL = root@gov.cn
DEFAULT_ADMIN_PASSWORD = admin123
```

> **注意**：`SECRET_KEY` 需要随机生成，可用 `openssl rand -hex 32` 生成。

### 2.4 创建 Systemd 服务

```bash
sudo tee /etc/systemd/system/gitea.service << 'EOF'
[Unit]
Description=Gitea (Git with a cup of tea)
After=network.target
After=openGauss.service

[Service]
User=git
Group=git
WorkingDirectory=/home/git/gitea
ExecStart=/usr/local/bin/gitea web --config /home/git/gitea/custom/conf/app.ini
Restart=always
Environment=USER=git HOME=/home/git GITEA_WORK_DIR=/home/git/gitea

[Install]
WantedBy=multi-user.target
EOF
```

### 2.5 启动 Gitea

```bash
# 重载配置
sudo systemctl daemon-reload

# 启动 Gitea
sudo systemctl start gitea

# 设置开机自启
sudo systemctl enable gitea

# 检查状态
sudo systemctl status gitea
```

### 2.6 生成 Gitea Admin Token

访问 `http://<服务器IP>:3000` 登录后：

1. 点击右上角头像 → **设置**
2. 左侧菜单 → **应用**
3. **生成新令牌** → 令牌名称填入 `gov-bff`
4. 勾选全部权限 → 点击**生成令牌**
5. 复制生成的 `sha1` 令牌（形如 `5a9cc3c8991decc6bf7245db9106286528b3377a`）

此令牌后续填入 BFF 的 `.env` 配置中。

---

## 第三步：部署 BFF 后端服务

### 3.1 克隆项目

```bash
# 在服务器上（如 /home/git/ 目录）
cd /home/git
git clone <项目仓库地址> gov-code-manager
cd gov-code-manager/bff
```

### 3.2 安装依赖

```bash
cd /home/git/gov-code-manager/bff
npm install
```

### 3.3 配置环境变量

```bash
cp .env.example .env
```

编辑 `bff/.env`，填入实际配置：

```env
# 服务端口
PORT=8080
NODE_ENV=production

# OpenGauss 数据库配置
DB_HOST=192.168.100.142
DB_PORT=15432
DB_NAME=gov_code_manager
DB_USER=dev_admin
DB_PASSWORD=Besti@2026_db

# Gitea API 配置
GITEA_URL=http://192.168.100.142:3000
GITEA_API_VERSION=v1
GITEA_ADMIN_TOKEN=5a9cc3c8991decc6bf7245db9106286528b3377a

# JWT 配置（生产环境请改为随机32位字符串）
JWT_SECRET=gov_code_manager_jwt_secret_key_2024_secure
JWT_EXPIRES_IN=7d

# 审计日志配置
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=3650

# BFF API 路径前缀
BFF_API_PREFIX=/api/bff

# CORS 白名单
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.100.142:3000,http://192.168.100.142:80
```

### 3.4 启动 BFF 服务

**方式一：直接启动（测试用）**

```bash
cd /home/git/gov-code-manager/bff
npm start
```

**方式二：PM2 守护进程（推荐生产环境）**

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start src/index.js --name gov-bff

# 设置开机自启
pm2 save
pm2 startup

# 查看日志
pm2 logs gov-bff
```

**方式三：Systemd 服务**

```bash
sudo tee /etc/systemd/system/gov-bff.service << 'EOF'
[Unit]
Description=GovCode Manager BFF Service
After=network.target

[Service]
Type=simple
User=git
WorkingDirectory=/home/git/gov-code-manager/bff
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start gov-bff
sudo systemctl enable gov-bff
```

### 3.5 验证 BFF 服务

```bash
# 健康检查
curl http://localhost:8080/health

# 预期返回
# {"status":"ok","service":"gov-code-manager-bff","version":"1.0.0","database":"connected",...}
```

---

## 第四步：部署前端应用

### 4.1 构建前端

```bash
cd /home/git/gov-code-manager/front

# 复制并编辑环境变量
cp .env.example .env
# 编辑 .env 设置 API 地址（见下方）

npm install
npm run build
```

`front/.env` 配置：

```env
# BFF API 地址（部署在同一台机器上用 localhost）
VITE_API_BASE_URL=http://localhost:8080/api/bff

# Gitea 服务器地址
VITE_GITEA_URL=http://192.168.100.142:3000

# 应用配置
VITE_APP_TITLE=党政软件版本管控平台
VITE_APP_VERSION=1.0.0
```

### 4.2 配置 Nginx

Nginx 配置 (`/etc/nginx/conf.d/gov-code.conf`)：

```nginx
server {
    listen 80;
    server_name _;

    # 前端静态文件
    root /home/git/gov-code-manager/front/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1024;

    # 单页应用路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # BFF API 代理
    location /api/bff/ {
        proxy_pass http://127.0.0.1:8080/api/bff/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Authorization;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Gitea 代理（可选，便于前端统一域名访问）
    location /gitea/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 健康检查
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.3 重启 Nginx

```bash
# 测试配置
sudo nginx -t

# 重新加载
sudo nginx -s reload
```

### 4.4 验证前端

浏览器访问 `http://<服务器IP>`，应看到登录页面。

---

## Docker 一键部署

如果服务器已安装 Docker 和 Docker Compose，可以使用容器化部署：

### 前置条件

确保服务器上已安装：
- Docker ≥ 20.10
- Docker Compose ≥ 2.0
- Gitea 已在宿主机运行（端口 3000）
- OpenGauss 已在宿主机运行（端口 15432）

### 部署步骤

```bash
cd /home/git/gov-code-manager

# 编辑环境变量（按实际环境修改数据库地址等）
cp .env.example .env
vim .env

# 构建并启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

Docker Compose 包含两个服务：

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|:---:|------|
| frontend | nginx + Vue 静态文件 | 80 | 前端 + Nginx 反向代理 |
| bff | Node.js Express | 8080 | BFF 中间层 API |

---

## 配置说明

### BFF 环境变量完整列表 (.env)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | BFF 服务端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `DB_TYPE` | `opengauss` | 数据库类型 |
| `DB_HOST` | `172.30.94.142` | 数据库地址 |
| `DB_PORT` | `15432` | 数据库端口 |
| `DB_NAME` | `gov_code_manager` | 数据库名 |
| `DB_USER` | `dev_admin` | 数据库用户 |
| `DB_PASSWORD` | — | 数据库密码 |
| `DB_SSL` | `false` | SSL 连接 |
| `GITEA_URL` | `http://172.30.94.142:3000` | Gitea 服务地址 |
| `GITEA_ADMIN_TOKEN` | — | Gitea Admin API Token（sha1 格式） |
| `JWT_SECRET` | — | JWT 签名密钥（生产环境务必修改） |
| `JWT_EXPIRES_IN` | `7d` | JWT 过期时间 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `AUDIT_LOG_ENABLED` | `true` | 启用审计日志 |
| `BFF_API_PREFIX` | `/api/bff` | API 路径前缀 |
| `CORS_ORIGINS` | `http://localhost:3000,...` | CORS 白名单（逗号分隔） |

### 前端环境变量 (.env)

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | BFF API 完整地址（含 /api/bff） |
| `VITE_GITEA_URL` | Gitea 服务完整地址 |
| `VITE_APP_TITLE` | 应用标题 |
| `VITE_APP_VERSION` | 应用版本号 |

---

## API 接口概览

基础路径：`/api/bff`

| 模块 | 路径前缀 | 主要接口 |
|------|----------|----------|
| 认证 | `/api/bff/auth` | 登录/登出/获取用户信息 |
| 仓库 | `/api/bff/repos` | CRUD/列表/过滤 |
| 分支 | `/api/bff/branches` | 列表/创建/删除 |
| 版本 | `/api/bff/versions` | 列表/创建(tag)/详情/下载 |
| 基线 | `/api/bff/baselines` | 列表/创建/变更/冻结/解冻 |
| 归档 | `/api/bff/archives` | 列表/创建/还原/下载 |
| 审批 | `/api/bff/approvals` | 待审批/我的申请/历史/流程配置 |
| 审计 | `/api/bff/audit` | 日志列表/详情/导出/风险预警 |
| 用户管理 | `/api/bff/users` | CRUD/角色分配/锁定解锁 |
| 角色 | `/api/bff/roles` | CRUD/权限配置 |
| 部门 | `/api/bff/departments` | CRUD/树形结构 |
| 通知 | `/api/bff/notifications` | 列表/标记已读/计数 |
| 统计 | `/api/bff/statistics` | 仪表盘/趋势图 |
| 系统 | `/api/bff/system` | 系统配置/设置 |
| Gitea 代理 | `/api/bff/gitea/*` | 透传 Gitea API |

> 完整 API 接口规范详见 [docs/API_SPEC.md](docs/API_SPEC.md)（57 个接口的完整定义）。

---

## 项目目录结构

```
gov-code-manager/
├── bff/                          # BFF 后端服务
│   ├── src/
│   │   ├── index.js             # 入口文件，Express 应用启动
│   │   ├── config/
│   │   │   └── index.js         # 配置加载（.env → config 对象）
│   │   ├── database/
│   │   │   ├── connection.js    # Knex 连接池 + 建表迁移 + 种子数据
│   │   │   ├── migrate.js       # 数据库迁移脚本
│   │   │   └── seed.js          # 种子数据脚本
│   │   ├── routes/              # 26 个路由模块
│   │   │   ├── auth.js          # 认证路由（登录/登出/用户信息）
│   │   │   ├── repos.js         # 仓库路由
│   │   │   ├── approvals.js     # 审批路由
│   │   │   ├── audit.js         # 审计路由
│   │   │   ├── users.js         # 用户管理路由
│   │   │   ├── baselines.js     # 基线路由
│   │   │   ├── archives.js      # 归档路由
│   │   │   ├── statistics.js    # 统计路由
│   │   │   ├── gitea.js         # Gitea API 透传代理
│   │   │   └── ...              # 其余 16 个路由
│   │   ├── middleware/          # 中间件
│   │   │   ├── auth.js          # JWT 认证中间件
│   │   │   ├── permission.js    # 权限校验中间件
│   │   │   ├── audit.js         # 审计日志中间件
│   │   │   └── ...
│   │   ├── services/            # 服务层
│   │   └── stores/              # 状态缓存
│   ├── .env                     # 环境变量（生产配置）
│   ├── .env.example             # 环境变量模板
│   ├── Dockerfile               # Docker 构建文件
│   └── package.json             # 依赖和脚本
│
├── front/                        # 前端 Vue 3 应用
│   ├── src/
│   │   ├── views/               # 页面组件（17 个页面）
│   │   │   ├── repos/           # 仓库管理（列表/详情/创建）
│   │   │   ├── branches/        # 分支管理（列表/合并请求）
│   │   │   ├── versions/        # 版本管理（列表/基线/归档）
│   │   │   ├── approval/        # 审批管理（待审/申请/历史）
│   │   │   ├── audit/           # 审计管理（日志/报表/预警）
│   │   │   ├── admin/           # 系统管理（用户/角色/部门/备份）
│   │   │   ├── dashboard/       # 工作台
│   │   │   ├── profile/         # 个人中心
│   │   │   └── settings/        # 系统设置
│   │   ├── components/          # 公共组件
│   │   │   └── RowContextMenu.vue  # 表格行右击菜单
│   │   ├── composables/         # 可复用逻辑
│   │   │   ├── useResponsive.js    # 响应式断点检测
│   │   │   └── useRowContextMenu.js # 右击菜单状态管理
│   │   ├── api/                 # API 调用层
│   │   │   ├── index.js         # Axios 实例 + 拦截器
│   │   │   ├── bff.js           # BFF API 函数
│   │   │   ├── gitea.js         # Gitea API 函数
│   │   │   └── admin.js         # 管理 API 函数
│   │   ├── stores/              # Pinia 状态管理
│   │   │   ├── user.js          # 用户认证状态
│   │   │   └── ...
│   │   ├── router/              # Vue Router 路由
│   │   ├── styles/
│   │   │   └── main.scss        # 全局主题 + 响应式 + Element Plus 覆盖
│   │   └── utils/               # 工具函数
│   ├── .env                     # 前端环境变量
│   ├── .env.production          # 生产环境变量
│   ├── nginx.conf               # Nginx 配置（Docker 用）
│   ├── Dockerfile               # Docker 构建文件
│   ├── vite.config.js           # Vite 构建配置
│   └── package.json             # 依赖和脚本
│
├── docs/                         # 项目文档
│   ├── API_SPEC.md              # API 接口规范（57 个接口完整定义）
│   └── BUG_AND_SECURITY_REPORT.md # 安全漏洞与BUG审查报告
│
├── docker-compose.yml            # 生产环境 Docker Compose
├── docker-compose.dev.yml        # 开发环境 Docker Compose
├── deploy.sh                     # 裸机部署脚本
├── .env.example                  # 环境变量模板
└── README.md                     # 本文件
```

---

## 默认账号

### Gitea 管理员

| 字段 | 值 |
|------|-----|
| 用户名 | `root` |
| 密码 | `admin123` |
| 邮箱 | `root@gov.cn` |

### 平台角色

系统启动后，BFF 会自动在数据库中创建以下角色：

| 角色 | 角色编码 | 初始无用户，需在用户管理中分配 |
|------|----------|------|
| 系统管理员 | `admin` | 需手动将 Gitea 用户绑定到此角色 |
| 项目管理员 | `project_manager` | 同上 |
| 开发人员 | `developer` | 同上 |
| 审计人员 | `auditor` | 同上 |

> **首次使用**：先用 `root/admin123` 登录 Gitea 创建用户账号，然后在平台的「用户管理」中为每个用户分配角色。

---

## 常见问题

### Q1: BFF 启动时数据库连接失败？

```bash
# 检查 OpenGauss 是否运行
gs_ctl status -D /opt/software/openGauss/data

# 检查网络连通性
telnet <DB_HOST> 15432

# 检查 pg_hba.conf 认证配置
grep -A5 "0.0.0.0/0" /opt/software/openGauss/data/pg_hba.conf
```

### Q2: Gitea API 返回 403？

Gitea 1.22.6 版本要求所有 API 调用必须认证，且 Token 格式必须是 `token <sha1>`。
检查 `bff/.env` 中 `GITEA_ADMIN_TOKEN` 配置的 `sha1` 值是否正确。

### Q3: 前端访问 API 跨域错误？

检查 `bff/.env` 中 `CORS_ORIGINS` 是否包含前端访问地址。

### Q4: Docker 部署后前端页面 502？

```bash
# 检查容器状态
docker-compose ps

# 检查 BFF 容器日志
docker-compose logs bff

# 检查 BFF 能否连接数据库
docker exec gov-code-manager-bff curl http://localhost:8080/health
```

### Q5: 如何修改 JWT 密钥？

1. 编辑 `bff/.env` 中的 `JWT_SECRET`（生产环境务必使用随机字符串）
2. 重启 BFF 服务
3. 所有用户需要重新登录

### Q6: 数据库备份与恢复？

```bash
# 备份（使用 gs_dump）
gs_dump -U dev_admin -d gov_code_manager -f backup_$(date +%Y%m%d).sql -p 15432

# 恢复
gsql -U dev_admin -d gov_code_manager -f backup_20260727.sql -p 15432
```

---

## 安全说明

- ✅ 所有 API 请求需 JWT 认证
- ✅ 审计日志防篡改哈希链（SHA-256）
- ✅ 密码加密存储（bcrypt）
- ✅ 登录限流保护（5 次/分钟）
- ✅ CORS 跨域白名单控制
- ✅ Helmet 安全头
- ✅ 部门数据隔离中间件
- ✅ 密级权限管控

---

## License

Copyright © 2025-2026 电科院52组

---

> **技术支持**: 电科院52组
> **部署服务器**: `123.60.219.19`（生产环境）
