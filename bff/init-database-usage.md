# 数据库初始化指南

## 方式一：在服务器上直接执行 SQL（推荐）

### 1. 连接服务器
```bash
ssh root@123.60.219.19
```

### 2. 切换到 postgres 用户
```bash
su - postgres
```

### 3. 创建数据库
```bash
createdb gov_code_manager
```

### 4. 创建用户（如果不存在）
```bash
psql -d gov_code_manager

# 在 psql 中执行：
CREATE USER dev_admin WITH PASSWORD 'Besti@2026_db';
GRANT ALL PRIVILEGES ON DATABASE gov_code_manager TO dev_admin;
\q
```

### 5. 执行初始化脚本

方式 A - 下载 SQL 文件到服务器执行：
```bash
# 下载以下文件到服务器：
# - init-tables.sql
# - init-data.sql

# 执行表结构
psql -h 123.60.219.19 -U dev_admin -d gov_code_manager -f init-tables.sql

# 执行默认数据
psql -h 123.60.219.19 -U dev_admin -d gov_code_manager -f init-data.sql
```

方式 B - 直接复制粘贴 SQL：

```bash
# 连接数据库
psql -h 123.60.219.19 -U dev_admin -d gov_code_manager

# 复制粘贴 init-tables.sql 中的内容并执行
# 复制粘贴 init-data.sql 中的内容并执行

\dt  # 查看表是否创建成功
\q   # 退出
```

---

## 方式二：在本地 Windows 使用 pgAdmin

### 1. 下载安装 pgAdmin
- 下载地址：https://www.pgadmin.org/download/
- 或下载 PostgreSQL 安装包（含 pgAdmin）

### 2. 连接数据库
1. 打开 pgAdmin
2. 右键 "Servers" → "Create" → "Server"
3. 填写连接信息：
   - Name: GovCodeManager
   - Host: 123.60.219.19
   - Port: 5432
   - Database: gov_code_manager
   - Username: dev_admin
   - Password: Besti@2026_db

### 3. 执行 SQL 文件
1. 右键数据库 → "Query Tool"
2. 打开 init-tables.sql 文件，执行
3. 打开 init-data.sql 文件，执行

---

## 方式三：在本地 Windows 使用命令行

### 1. 安装 PostgreSQL 客户端
```powershell
# 使用 Chocolatey
choco install postgresql

# 或下载安装包
# https://www.postgresql.org/download/windows/
```

### 2. 执行初始化
```powershell
# 设置环境变量
$env:PGPASSWORD="Besti@2026_db"

# 创建数据库（如果 postgres 用户有权限）
psql -h 123.60.219.19 -U postgres -c "CREATE DATABASE gov_code_manager;"

# 创建用户（如果需要）
psql -h 123.60.219.19 -U postgres -c "CREATE USER dev_admin WITH PASSWORD 'Besti@2026_db';"

# 执行表结构
psql -h 123.60.219.19 -U dev_admin -d gov_code_manager -f "D:\AI前端\gov-code-manager\bff\init-tables.sql"

# 执行默认数据
psql -h 123.60.219.19 -U dev_admin -d gov_code_manager -f "D:\AI前端\gov-code-manager\bff\init-data.sql"
```

---

## 方式四：直接通过 BFF 自动初始化

BFF 服务启动时会自动检测并创建表结构：

```bash
# 1. 安装依赖
cd d:/AI前端/gov-code-manager/bff
npm install

# 2. 启动 BFF（会自动初始化数据库）
npm run dev
```

如果数据库连接成功，会自动：
- ✅ 创建数据表
- ✅ 插入默认角色
- ✅ 插入默认部门
- ✅ 插入默认审批流程
- ✅ 插入默认版本规则

---

## 验证数据库初始化成功

```sql
-- 连接数据库
psql -h 123.60.219.19 -U dev_admin -d gov_code_manager

-- 查看所有表
\dt

-- 应该看到以下表：
--  approval_flows
--  approvals
--  approval_records
--  baselines
--  archives
--  audit_logs
--  departments
--  roles
--  user_profiles
--  sessions
--  notifications
--  risk_warnings
--  reports
--  backups
--  system_config
--  version_rules

-- 查看角色
SELECT * FROM roles;

-- 查看部门
SELECT * FROM departments;
```

---

## 常见问题

### Q: 连接被拒绝
```
could not connect to server: Connection refused
```
- 检查服务器防火墙是否开放 5432 端口
- 检查 PostgreSQL/openGauss 是否允许远程连接

### Q: 权限不足
```
permission denied for database
```
- 使用 postgres 管理员账号创建数据库和用户
- 或让 DBA 授权

### Q: 数据库已存在
```
ERROR: database "gov_code_manager" already exists
```
- 这是正常的，脚本使用了 `CREATE TABLE IF NOT EXISTS`
- 可以忽略这个错误

### Q: openGauss 连接方式
openGauss 兼容 PostgreSQL 协议，使用标准的 psql 或 pg 驱动即可连接。

---

## 下一步

数据库初始化完成后，启动 BFF 服务：

```bash
cd d:/AI前端/gov-code-manager/bff
npm install
npm run dev
```
