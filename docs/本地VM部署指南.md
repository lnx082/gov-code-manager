# 党政软件版本管控平台 — 本地 Hyper-V Ubuntu VM 部署指南

> **目标**：将原云服务器（`123.60.219.19`）上的 openGauss + Gitea 迁移到本地 Hyper-V 虚拟机，作为新的服务器环境。
>
> **前置条件**：Ubuntu VM 已安装 openGauss（未建库建表），未安装 Gitea。

---

## 一、确认 VM 网络与 IP

首先在 Ubuntu VM 中确认 IP 地址，后续所有配置都用这个 IP：

```bash
ip addr show | grep inet
```

假设 VM 的 IP 为 `192.168.x.x`（例如 `192.168.10.100`），下文用 `<VM_IP>` 指代。

**重要**：Hyper-V 默认使用动态 IP，建议在 Ubuntu 中设置静态 IP，或在 Hyper-V 管理器中将虚拟交换机配置为固定 IP 段，避免重启后 IP 变化导致项目配置失效。建议在 Ubuntu 中执行：

```bash
# 查看当前使用的网卡名称
ip route show default

# 示例：使用 netplan 设置静态 IP（Ubuntu 22.04+）
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
# 静态 IP 示例（按实际情况修改网卡名和网段）
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.10.100/24
      routes:
        - to: default
          via: 192.168.10.1
      nameservers:
        addresses: [8.8.8.8, 114.114.114.114]
```

```bash
sudo netplan apply
```

---

## 二、openGauss 建库建表

### 2.1 确认 openGauss 运行状态

```bash
# 检查 openGauss 是否在运行
sudo systemctl status opengauss
# 或
ps aux | grep gaussdb
```

如果未运行，启动它：
```bash
sudo systemctl start opengauss
```

### 2.2 登录 openGauss 并创建数据库

使用 openGauss 的管理用户（通常为 `omm`）连接：

```bash
# 切换到 omm 用户
sudo su - omm

# 连接数据库
gsql -d postgres -p 5432
```

在 `gsql` 中依次执行：

```sql
-- 1. 创建应用数据库
CREATE DATABASE gov_code_manager
  ENCODING 'UTF8'
  LC_COLLATE 'C'
  LC_CTYPE 'C'
  TEMPLATE template0;

-- 2. 创建应用数据库用户（与项目 .env 中的 DB_USER 一致）
CREATE USER dev_admin WITH PASSWORD 'Besti@2026_db';
GRANT ALL PRIVILEGES ON DATABASE gov_code_manager TO dev_admin;
ALTER USER dev_admin CREATEDB;

-- 3. 切换到目标数据库
\c gov_code_manager

-- 4. 授予 schema public 权限
GRANT ALL ON SCHEMA public TO dev_admin;
GRANT USAGE ON SCHEMA public TO dev_admin;

-- 验证
\du
\l
\q
```

### 2.3 配置 openGauss 远程连接（允许外部 IP 访问）

编辑 `pg_hba.conf`：

```bash
# 找到 pg_hba.conf 位置
find / -name "pg_hba.conf" 2>/dev/null | grep -v .bak
```

在文件中添加一行（允许内网所有 IP 通过密码连接）：

```
# IPv4 local connections — 允许 BFF 所在的机器连接
host    all             all             192.168.0.0/16          sha256
host    all             all             127.0.0.1/32            sha256
```

编辑 `postgresql.conf`（与 `pg_hba.conf` 同目录），确保监听所有接口：

```
listen_addresses = '0.0.0.0'
port = 5432
```

重启 openGauss：
```bash
sudo systemctl restart opengauss
# 或
gs_ctl restart -D <openGauss数据目录>
```

### 2.4 验证远程连接

从宿主机（Windows）测试连通性：

```powershell
# 在 Windows 上使用 telnet 或 powershell 测试端口
Test-NetConnection -ComputerName <VM_IP> -Port 5432
```

### 2.5 建表（两种方式任选其一）

**方式一（推荐）：让 BFF 启动时自动建表**

项目 `bff/src/database/connection.js` 的 `fixDatabaseSchema()` + `runMigrations()` 会在 BFF 启动时自动检查并创建所有 15 张表、插入默认角色/部门/审批流数据。只需确保 `.env` 中数据库连接正确，然后启动 BFF 即可：

```bash
cd bff
npm install
npm run dev
```

启动日志中会看到：
```
📦 初始化 openGauss 数据库连接...
🔍 检查数据库表结构...
✅ repo_metadata 表已就绪
✅ 数据库表结构检查完成
📝 插入默认数据...
   ✅ 默认角色已插入
   ✅ 默认部门已插入
   ✅ 默认审批流程已插入
```

**方式二：手动执行 SQL 脚本**

```bash
# 在 Ubuntu VM 上
sudo su - omm
gsql -d gov_code_manager -p 5432 -f /path/to/bff/init-tables.sql
gsql -d gov_code_manager -p 5432 -f /path/to/bff/init-data.sql
gsql -d gov_code_manager -p 5432 -f /path/to/bff/migrate-add-columns.sql
```

---

## 三、Gitea 安装与配置

### 3.1 下载并安装 Gitea

```bash
# 下载 Gitea 二进制文件（以 1.22 版本为例）
cd /tmp
wget https://dl.gitea.com/gitea/1.22.7/gitea-1.22.7-linux-amd64 -O gitea
sudo mv gitea /usr/local/bin/gitea
sudo chmod +x /usr/local/bin/gitea

# 验证
gitea --version
```

> 如果 VM 网络无法直接访问外网，可在宿主机下载后通过 `scp` 传送到 VM：
> ```powershell
> scp gitea-1.22.7-linux-amd64 <user>@<VM_IP>:/tmp/gitea
> ```

### 3.2 准备 Gitea 用户和目录

```bash
# 创建 git 系统用户
sudo adduser --system --shell /bin/bash --group --home /home/git git

# 创建 Gitea 工作目录
sudo mkdir -p /var/lib/gitea/{custom,data,log}
sudo chown -R git:git /var/lib/gitea/
sudo chmod -R 750 /var/lib/gitea/
sudo mkdir -p /etc/gitea
sudo chown root:git /etc/gitea
sudo chmod 770 /etc/gitea
```

### 3.3 在 openGauss 中创建 Gitea 专用数据库

```bash
sudo su - omm
gsql -d postgres -p 5432
```

```sql
-- Gitea 使用单独的数据库
CREATE DATABASE gitea_db
  ENCODING 'UTF8'
  LC_COLLATE 'C'
  LC_CTYPE 'C'
  TEMPLATE template0;

CREATE USER gitea_user WITH PASSWORD 'Gitea@2026_db';
GRANT ALL PRIVILEGES ON DATABASE gitea_db TO gitea_user;
\q
```

### 3.4 配置 Gitea

编辑 `/etc/gitea/app.ini`：

```bash
sudo nano /etc/gitea/app.ini
```

```ini
# Gitea 配置文件
APP_NAME = 党政软件版本管控平台 - 代码仓库
RUN_USER = git
RUN_MODE = prod

[server]
DOMAIN           = <VM_IP>
HTTP_ADDR        = 0.0.0.0
HTTP_PORT        = 3000
ROOT_URL         = http://<VM_IP>:3000/
DISABLE_SSH      = false
SSH_DOMAIN       = <VM_IP>
LFS_START_SERVER = true
OFFLINE_MODE     = false

[database]
DB_TYPE  = postgres
HOST     = 127.0.0.1:5432
NAME     = gitea_db
USER     = gitea_user
PASSWD   = Gitea@2026_db
SCHEMA   = public
LOG_SQL  = false

[repository]
ROOT = /var/lib/gitea/data/git/repositories

[security]
INSTALL_LOCK       = true
SECRET_KEY         = <随机生成64位字符串>

[service]
DISABLE_REGISTRATION   = true
SHOW_REGISTRATION_BUTTON = false
REQUIRE_SIGNIN_VIEW    = true

[mailer]
ENABLED = false

[log]
MODE = file
LEVEL = Info
ROOT_PATH = /var/lib/gitea/log

[api]
ENABLE_SWAGGER = true
MAX_RESPONSE_ITEMS = 100
```

> **SECRET_KEY 生成方式**：`openssl rand -base64 48`

### 3.5 创建 Gitea systemd 服务

```bash
sudo nano /etc/systemd/system/gitea.service
```

```ini
[Unit]
Description=Gitea (Git with a cup of tea)
After=network.target opengauss.service
Requires=opengauss.service

[Service]
Type=simple
User=git
Group=git
WorkingDirectory=/var/lib/gitea/
ExecStart=/usr/local/bin/gitea web --config /etc/gitea/app.ini
Restart=always
Environment=USER=git HOME=/home/git GITEA_WORK_DIR=/var/lib/gitea

[Install]
WantedBy=multi-user.target
```

```bash
# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable gitea
sudo systemctl start gitea

# 检查状态
sudo systemctl status gitea
```

### 3.6 创建 Gitea 管理员账户

访问 `http://<VM_IP>:3000`，按安装向导完成首次配置，或使用命令行创建管理员：

```bash
# 命令行创建管理员
sudo -u git gitea admin user create \
  --admin \
  --username besti \
  --password huawai666 \
  --email besti@gov.local \
  --config /etc/gitea/app.ini
```

### 3.7 生成 Gitea Access Token（供 BFF 调用 API）

1. 浏览器访问 `http://<VM_IP>:3000`
2. 使用 `besti` 账户登录
3. 点击右上角头像 → **设置** → **应用** → **生成新的令牌**
4. 令牌名称：`bff-api-token`
5. 权限：全选（repo、user、admin 等全部勾选）
6. 复制生成的 Token（格式如 `fe4a8c3...`，只显示一次！）

### 3.8 在 Gitea 中创建测试仓库

登录后创建至少一个测试仓库（如 `test-repo`），否则 BFF 的仓库列表相关功能初次使用时会返回空数据。

### 3.9 配置 Gitea CORS（允许前端跨域访问）

默认 Gitea 不允许跨域 API 调用。编辑 `/etc/gitea/app.ini` 追加：

```ini
[cors]
ENABLED = true
ALLOW_DOMAIN = *
METHODS = GET,POST,PUT,DELETE,PATCH,OPTIONS
```

重启 Gitea：
```bash
sudo systemctl restart gitea
```

---

## 四、调整项目配置文件

### 4.1 BFF 后端配置 — `bff/.env`

需要修改 `DB_HOST`、`GITEA_URL` 和 `GITEA_ADMIN_TOKEN` 三项：

```bash
# bff/.env — 修改后内容
PORT=8080
NODE_ENV=production

# ★ openGauss — 改为 VM 的 IP
DB_HOST=<VM_IP>
DB_PORT=5432
DB_NAME=gov_code_manager
DB_USER=dev_admin
DB_PASSWORD=Besti@2026_db

# ★ Gitea — 改为 VM 的 IP
GITEA_URL=http://<VM_IP>:3000
GITEA_API_VERSION=v1
# ★ Gitea Token — 基础认证格式：Basic base64(用户名:密码)
#  注意：新版 Gitea 使用 token 认证，格式为：
#  Authorization: token <access-token>
#  如果 BFF 代码中使用的是 Basic Auth 模式，填写：
GITEA_ADMIN_TOKEN=Basic YmVzdGk6aHVhd2VpNjY2
#  如果 BFF 使用的是 token 模式，填写：
# GITEA_ADMIN_TOKEN=token <步骤3.7生成的Token>

# JWT 配置（生产环境请修改为安全的随机字符串）
JWT_SECRET=gov_code_manager_jwt_secret_key_2024_secure
JWT_EXPIRES_IN=7d

# 审计日志
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=3650

# API 配置
BFF_API_PREFIX=/api/bff

# ★ CORS 白名单 — 增加 VM 的前端地址
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://<VM_IP>:3000,http://localhost:80
```

### 4.2 前端配置 — `front/.env`

```bash
# front/.env — 修改后内容
VITE_APP_TITLE=党政软件版本管控平台
VITE_APP_VERSION=1.0.0

# API — 如果前端在宿主机开发，BFF 也在宿主机，不变
VITE_API_BASE_URL=http://localhost:8080/api/bff
# ★ Gitea — 改为 VM 的 IP
VITE_GITEA_URL=http://<VM_IP>:3000
```

### 4.3 Docker Compose 配置 — `docker-compose.yml`

默认值中的 IP 改为 VM IP：

```yaml
environment:
  - DB_HOST=${DB_HOST:-<VM_IP>}
  - DB_PORT=${DB_PORT:-5432}
  - DB_NAME=${DB_NAME:-gov_code_manager}
  - DB_USER=${DB_USER:-dev_admin}
  - DB_PASSWORD=${DB_PASSWORD:-Besti@2026_db}
  - GITEA_URL=${GITEA_URL:-http://<VM_IP>:3000}
```

### 4.4 无须修改的文件

| 文件 | 原因 |
|------|------|
| `front/vite.config.js` | 只代理本地 BFF (`127.0.0.1:8080`)，不涉及服务器 IP |
| `front/nginx.conf` | Docker 内部用 `bff:8080`（容器网络），不涉及外部 IP |
| `bff/src/config/index.js` | 全部从 `.env` 读取，本身不用改 |
| `tests/config.js` | 默认连接 localhost，本地测试不变 |

---

## 五、验证与启动

### 5.1 验证数据库连接

```bash
cd bff
npm install

# 直接用 knex CLI 测试数据库连接
npx knex --client=pg --connection="host=<VM_IP> port=5432 user=dev_admin password=Besti@2026_db database=gov_code_manager" --eval "SELECT version();"
```

### 5.2 验证 Gitea API

```bash
# 在宿主机测试 Gitea 是否可达
curl http://<VM_IP>:3000/api/v1/version

# 预期返回：{"version": "1.22.7"}
```

### 5.3 启动 BFF（自动建表 + 种子数据）

```bash
cd bff
npm run dev
```

观察启动日志，确认：
- `✅ 数据库连接成功`
- `✅ 数据库表结构检查完成`
- `✅ 默认角色/部门/审批流程已插入`

### 5.4 启动前端

```bash
cd front
npm install
npm run dev
```

访问 `http://localhost:3000`，确认能正常登录并与 Gitea 交互。

### 5.5 可选：Docker 部署

如果需要在 VM 上以 Docker 方式运行：

```bash
# 在项目根目录
docker-compose up -d
```

---

## 六、常见问题

### Q1: openGauss 连接失败（`password authentication failed`）

检查 `pg_hba.conf` 是否允许 BFF 所在机器的 IP 段：

```
host    all    all    192.168.0.0/16    sha256
```

修改后务必重启 openGauss。

### Q2: Gitea 前端跨域报错

确保 `/etc/gitea/app.ini` 中 `[cors]` 已配置且重启了 Gitea。

检查方法：
```bash
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS http://<VM_IP>:3000/api/v1/version -v
```

应在响应头中看到 `Access-Control-Allow-Origin`。

### Q3: BFF 连接 openGauss 报版本解析错误

项目 `connection.js` 已内置 openGauss 版本兼容补丁（第 17-27 行），如果遇到问题，确认 `bff/src/database/connection.js` 中的 `_parseVersion` 方法存在且未被修改。

### Q4: Gitea 中仓库列表为空

BFF 显示仓库来自 Gitea。需要在 Gitea 中至少创建一个仓库（使用 `besti` 账户登录 Gitea Web 界面创建）。

### Q5: 凭据不匹配

- **Gitea admin 密码**：与创建时一致（`huawai666`）
- **Gitea API Token**：如果代码中使用的是 Token 认证（`token <hash>`），需要在 Gitea Web 界面生成，不要用 Basic Auth
- **openGauss 密码**：`Besti@2026_db`，注意 `@` 等特殊字符需正确转义

---

## 七、变更文件清单（供 Git 管理参考）

| 文件 | 变更内容 | 建议 |
|------|---------|------|
| `bff/.env` | `DB_HOST`、`GITEA_URL`、`GITEA_ADMIN_TOKEN` | **不要提交**（包含密码），加入 `.gitignore` |
| `front/.env` | `VITE_GITEA_URL` | 可提交（无敏感信息） |
| `docker-compose.yml` | 默认值中的 IP | 可提交 |
| `/etc/gitea/app.ini` | Gitea 服务端配置 | 保留在 VM |

> **建议**：在项目根目录创建 `bff/.env.example`（不含真实密码）作为配置模板，将 `bff/.env` 加入 `.gitignore` 防止密码泄露。
