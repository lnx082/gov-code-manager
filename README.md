# 党政软件版本管控平台

GovCode Version Control Platform - 党政机关软件版本控制平台

## 功能特性

### 核心功能
- 🔒 **安全可控**: 符合等保2.0三级要求，全流程审计溯源
- 📋 **合规审批**: 多级审批流程，版本管控规范化
- 🛡️ **信创适配**: 国产化环境适配，麒麟鲲鹏兼容
- 📊 **全程溯源**: 防篡改审计日志，操作永久留存
- 🔐 **权限管控**: 细粒度权限控制，部门数据隔离
- 💾 **版本管理**: 标准化版本编号，基线固化封存

### 角色权限
- 👨‍💼 **系统管理员**: 全系统管理
- 👩‍💻 **项目管理员**: 仓库和版本管理
- 👨‍💻 **开发人员**: 代码提交和分支操作
- 🔍 **审计人员**: 查看审计日志和报表
- 👤 **普通用户**: 查看权限

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     客户端 (浏览器)                           │
│                  Vue 3 + Element Plus                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   BFF 层 (Node.js/Express)                  │
│               http://123.60.219.19:8080                      │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐  │
│  │   认证模块   │   仓库模块   │   审批模块   │   审计模块   │  │
│  └─────────────┴─────────────┴─────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │  Gitea   │        │PostgreSQL│        │ 审计日志  │
    │ SQLite   │        │   数据库  │        │ (防篡改)  │
    └──────────┘        └──────────┘        └──────────┘
```

## 目录结构

```
gov-code-manager/
├── bff/                    # BFF 后端服务
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── middleware/    # 中间件
│   │   ├── database/      # 数据库连接
│   │   └── config/        # 配置文件
│   └── .env              # 环境变量
│
├── front/                 # 前端应用
│   ├── src/
│   │   ├── views/        # 页面组件
│   │   ├── api/          # API 调用
│   │   ├── stores/       # 状态管理
│   │   └── router/       # 路由配置
│   └── .env              # 环境变量
│
├── start.bat              # Windows 启动脚本
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
# 安装后端依赖
cd bff
npm install

# 安装前端依赖
cd ../front
npm install
```

### 配置环境变量

复制并编辑配置文件：

```bash
# BFF 后端
cp bff/.env.example bff/.env
# 编辑 bff/.env 设置数据库连接等信息

# 前端
# 编辑 front/.env 设置 API 地址
```

### 启动服务

```bash
# 启动后端 (终端 1)
cd bff
npm run dev

# 启动前端 (终端 2)
cd front
npm run dev
```

访问 http://localhost:3000

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | root | admin123 |
| 开发人员 | git | admin123 |

## API 接口

### 认证模块 `/api/bff/auth`
- `POST /login` - 用户登录
- `POST /logout` - 用户登出
- `GET /me` - 获取当前用户信息

### 仓库模块 `/api/bff/repos`
- `GET /` - 获取仓库列表
- `GET /:owner/:repo` - 获取仓库详情
- `GET /:owner/:repo/branches` - 获取分支列表
- `GET /:owner/:repo/commits` - 获取提交历史

### 审批模块 `/api/bff/approvals`
- `GET /` - 获取审批列表
- `GET /pending` - 获取待审批列表
- `POST /` - 创建审批申请
- `POST /:id/process` - 处理审批

### 审计模块 `/api/bff/audit`
- `GET /logs` - 获取审计日志
- `POST /logs/verify-integrity` - 验证日志完整性
- `GET /stats/operations` - 获取操作统计

## 数据库配置

### PostgreSQL
```env
DB_TYPE=postgres
DB_HOST=123.60.219.19
DB_PORT=5432
DB_NAME=gov_code_manager
DB_USER=postgres
DB_PASSWORD=your_password
```

### SQLite (Gitea)
```env
DB_TYPE=sqlite
DB_FILENAME=/home/git/data/gitea.db
```

## 部署说明

### 生产环境部署

1. 编译前端
```bash
cd front
npm run build
```

2. 配置 Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /path/to/front/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api/bff {
        proxy_pass http://localhost:8080/api/bff;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. 启动后端服务 (使用 PM2)
```bash
npm install -g pm2
cd bff
pm2 start src/index.js --name gov-bff
pm2 save
pm2 startup
```

## 安全说明

- ✅ 所有 API 请求需要认证
- ✅ 审计日志防篡改链
- ✅ 密码加密存储 (bcrypt)
- ✅ JWT Token 认证
- ✅ 登录限流保护
- ✅ CORS 跨域控制

## License

Copyright © 2024 党政机关 - All Rights Reserved
