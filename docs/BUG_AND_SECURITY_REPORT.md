# 党政软件版本管控平台 — 安全漏洞与BUG审查报告

> **审查日期**: 2026-07-13
> **审查范围**: 全项目（BFF后端 × 27个路由文件 + Vue前端 × 47个源文件 + 配置文件 + Docker部署 + 中间件 + 数据库）
> **审查方式**: 四维度并行静态代码审查（认证授权 / API路由 / 前端安全 / 基础设施），仅发现问题，不做修复
> **发现问题总数**: **42个**

---

## 目录

1. [严重漏洞 (CRITICAL) — 9个](#1-严重漏洞-critical)
2. [高危漏洞 (HIGH) — 13个](#2-高危漏洞-high)
3. [中危问题 (MEDIUM) — 12个](#3-中危问题-medium)
4. [低危问题 (LOW) — 8个](#4-低危问题-low)
5. [总结与统计](#5-总结与统计)

---

## 1. 严重漏洞 (CRITICAL)

### C-01: 生产凭据硬编码并提交到代码仓库

**文件**: [bff/.env](bff/.env#L1-L30) / [bff/src/config/index.js](bff/src/config/index.js#L29) / [docker-compose.yml](docker-compose.yml#L31-L36)

**描述**: `bff/.env` 文件包含真实的生产凭据且已被提交到Git仓库：

```
DB_HOST=123.60.219.19
DB_USER=dev_admin
DB_PASSWORD=Besti@2026_db
GITEA_ADMIN_TOKEN=Basic YmVzdGk6aHVhd2VpNjY2    ← Base64解码后为 besti:huawei666
JWT_SECRET=gov_code_manager_jwt_secret_key_2024_secure
```

同时，`config/index.js` 和 `docker-compose.yml` 中也以默认值的形式重复硬编码了数据库密码和JWT密钥。

**风险等级**: 🔴 CRITICAL

**影响**: 任何能访问源代码的人都能获得：
- openGauss数据库的完整访问权限（读写所有数据）
- Gitea管理员权限（控制所有代码仓库）
- JWT签名密钥（伪造任意用户的令牌，包括管理员）

**建议**: 立即轮换所有凭据；将 `.env` 从Git历史中彻底清除；使用密钥管理服务或加密存储。

---

### C-02: approvalFlows.js 全部6个路由无任何认证保护

**文件**: [bff/src/routes/approvalFlows.js](bff/src/routes/approvalFlows.js#L1-L236)

**描述**: 整个审批流程模板文件没有导入 `authenticate` 中间件，所有路由完全无需登录即可访问：

```javascript
import { Router } from 'express';
import { getDb } from '../database/connection.js';
// ★ 没有 import { authenticate } from '../middleware/auth.js'！

router.get('/', async (req, res, next) => { ... });         // 列出所有流程
router.get('/:flowId', async (req, res, next) => { ... });  // 查看单个流程
router.post('/', async (req, res, next) => { ... });         // 创建流程
router.put('/:flowId', async (req, res, next) => { ... });   // 修改流程
router.delete('/:flowId', async (req, res, next) => { ... });// 删除流程
router.get('/suggest/list', async (req, res, next) => { ... });// 建议列表
```

**风险等级**: 🔴 CRITICAL

**影响**: 未认证的攻击者可以：
- 枚举所有审批流程模板
- 创建恶意的"一步审批"流程并设为默认（代码第115行自动取消其他默认）
- 修改/删除现有审批流程
- 这会导致所有新提交的审批请求使用攻击者控制的流程，整个审批体系形同虚设

**建议**: 所有路由添加 `authenticate` 中间件，创建/修改/删除操作添加 `requireAdmin`。

---

### C-03: JWT Payload中嵌入Gitea Basic Auth凭据

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L256-L270) / [front/src/stores/user.js](front/src/stores/user.js#L55-L59)

**描述**: 登录时，用户的Gitea用户名和密码被编码为Basic Auth凭证，直接嵌入JWT的payload中：

```javascript
// auth.js:256-270
const token = jwt.sign({
  userId: giteaUser.id,
  username: giteaUser.login || username,
  giteaToken: giteaToken || '',  // ← "Basic base64(username:password)" 明文可解码！
}, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
```

前端从JWT提取并缓存该凭证：

```javascript
// stores/user.js:55-59
const payload = JSON.parse(atob(res.data.token.split('.')[1]))
if (payload.giteaToken) {
  setApiToken(payload.giteaToken)
}
```

**风险等级**: 🔴 CRITICAL

**影响**: 
- JWT的payload仅为Base64编码（非加密），任何人获取JWT后可直接解码看到Gitea密码
- 凭证随每次API请求在Authorization头中传输
- 结合XSS漏洞（H-01/H-02）可轻易窃取
- 该凭证被用于所有Gitea API代理调用，泄露后攻击者可完全控制用户的Gitea账户

**建议**: 使用Gitea Access Token替代Basic Auth；token仅在服务端存储，前端使用独立的session标识符。

---

### C-04: 用户信息更新路由无管理员权限校验（越权漏洞/IDOR）

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L221-L259)

**描述**:
```javascript
// PUT /:id — 仅 authenticate，无 requireAdmin！
router.put('/:id', authenticate, async (req, res, next) => {
  await checkNotAdmin(id);  // 只防止修改已有admin用户，不能防止将自己提升为admin
  const { nickname, role_code, department_id, is_active, email, secret_level } = req.body;
  // ↑ 任意登录用户可以修改任意用户的所有字段，包括 role_code！
  await db('user_profiles').where('user_id', id).update(updateData);
});
```

**风险等级**: 🔴 CRITICAL

**影响**: 任何已登录的普通用户（如developer角色）可以通过 `PUT /api/bff/users/{自己的ID}` 发送 `{"role_code": "admin"}`，将自己提升为系统管理员，获得全部权限。

**建议**: 添加 `requireAdmin` 中间件；非管理员用户只能修改自己的非敏感字段。

---

### C-05: 系统配置更新路由无管理员权限校验

**文件**: [bff/src/routes/system.js](bff/src/routes/system.js#L27-L53)

**描述**:
```javascript
// PUT /config — 仅 authenticate，无 requireAdmin！
router.put('/config', authenticate, async (req, res, next) => {
  const { configs } = req.body;
  // 任意登录用户可以修改全部系统配置
});
```

**风险等级**: 🔴 CRITICAL

**影响**: 任何登录用户可以修改系统配置表中的任意键值对，可能影响全局系统行为。

**建议**: 添加 `requireAdmin` 中间件。

---

### C-06: 审计日志明文记录密码等敏感请求体

**文件**: [bff/src/middleware/audit.js](bff/src/middleware/audit.js#L125-L126)

**描述**:
```javascript
request_body: JSON.stringify(req.body || {}).substring(0, 4000),
// ↓ 以及错误响应体
error_message: res.statusCode >= 400 ? (typeof body === 'string' ? body.substring(0, 500) : null) : null,
```

**风险等级**: 🔴 CRITICAL

**影响**: 所有请求体（包括登录密码 `password`、修改密码的 `oldPassword`/`newPassword`、JWT token等）都以明文写入 `audit_logs` 表的 `request_body` 字段。任何拥有 `audit:view` 权限的用户都能在审计日志中读取其他用户的明文密码。这是严重的合规风险（违反《个人信息保护法》和等保要求）。

**建议**: 在记录前对 `password`、`oldPassword`、`newPassword`、`token` 等敏感字段进行脱敏（替换为 `***`）。

---

### C-07: 开发环境JWT密钥强制覆盖为弱密钥

**文件**: [bff/src/config/index.js](bff/src/config/index.js#L110-L114)

**描述**:
```javascript
if (config.nodeEnv === 'development') {
  config.jwt.secret = 'dev_jwt_secret_do_not_use_in_production'; // ← 无视环境变量！
```

**风险等级**: 🔴 CRITICAL

**影响**: 开发环境下JWT密钥被强制覆盖为固定字符串，即使通过环境变量设置了安全的密钥也会被丢弃。若 `NODE_ENV` 配置不当导致生产环境误用开发模式，整个认证体系立即失效。

**建议**: 开发环境也从环境变量读取JWT密钥；使用随机生成的临时密钥并明确日志提示。

---

### C-08: 数据库迁移脚本创建默认管理员账号（弱密码）

**文件**: [bff/src/database/migrate.js](bff/src/database/migrate.js#L436-L461) / [bff/src/database/connection.js](bff/src/database/connection.js#L656)

**描述**: 数据库初始化时创建 `root/admin123` 和 `git/admin123` 两个管理员账号。密码 `admin123` 是众所周知的弱密码。`start.sh`/`start.bat` 启动脚本中也明文打印了默认账号信息。

**风险等级**: 🔴 CRITICAL

**影响**: 任何未修改默认密码的部署都存在 `root:admin123` 的管理员后门。

**建议**: 首次启动时强制要求设置管理员密码；删除脚本中的默认密码打印。

---

### C-09: 管理员Gitea凭据无加密缓存到磁盘365天

**文件**: [bff/src/services/adminTokenCache.js](bff/src/services/adminTokenCache.js#L1-L58)

**描述**:
```javascript
const CACHE_FILE = path.join(__dirname, '..', '..', '.admin_token_cache');
const TTL = 365 * 24 * 60 * 60 * 1000; // 365天！

function persist() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ token: cachedAdminToken, ts: cachedAt }), 'utf8');
}
```

管理员Gitea Token（包含Basic Auth凭证）以明文JSON写入 `.admin_token_cache` 文件，有效期为365天。该文件**未列入 `.gitignore`**。

**风险等级**: 🔴 CRITICAL

**影响**: 文件系统被攻破后可直接读取管理员Gitea凭据；若被意外提交到Git仓库，凭据将永久保存在历史记录中。

**建议**: 不使用磁盘缓存；如必须缓存，使用加密存储并在 `.gitignore` 中排除。

---

## 2. 高危漏洞 (HIGH)

### H-01: XSS漏洞 — v-html渲染Gitea Release内容（仓库详情页）

**文件**: [front/src/views/repos/detail.vue](front/src/views/repos/detail.vue#L181)

**描述**:
```html
<div class="release-body" v-html="tagDetail.release.body_html || tagDetail.release.body || '无'"></div>
```

**风险等级**: 🟠 HIGH

**影响**: Gitea的release body_html可能包含恶意脚本。如果能向Gitea仓库提交包含恶意HTML/JS的release内容，这些代码会在所有查看该版本的用户的浏览器中执行，导致Token窃取等后果。

**建议**: 使用DOMPurify对 `body_html` 进行白名单过滤后再渲染。

---

### H-02: XSS漏洞 — v-html渲染Gitea Release内容（版本列表页）

**文件**: [front/src/views/versions/index.vue](front/src/views/versions/index.vue#L151)

**描述**:
```html
<div class="release-body" v-html="activeVersion.release.body_html || activeVersion.release.body"></div>
```

**风险等级**: 🟠 HIGH

**影响**: 同H-01，影响版本列表详情弹窗。

**建议**: 同H-01，使用DOMPurify。

---

### H-03: Token通过URL查询参数传递（多处）

**文件**: 
- [bff/src/middleware/auth.js](bff/src/middleware/auth.js#L15-L17)
- [front/src/utils/download.js](front/src/utils/download.js#L32)
- [front/src/views/audit/reports.vue](front/src/views/audit/reports.vue#L331-L332)

**描述**: 
```javascript
// 后端接受URL参数中的token
} else if (req.query.token) {
  token = req.query.token;
}

// 前端将token放入URL
const url = `${GITEA_URL}/.../archive/${ref}.zip?token=${encodeURIComponent(token)}`
```

**风险等级**: 🟠 HIGH

**影响**: Token出现在URL中会被记录在服务器访问日志、浏览器历史、代理日志和Referer头中，极易泄露。

**建议**: 后端不接受URL参数中的token；前端下载使用短期一次性token并通过POST/Header传递。

---

### H-04: 审计日志 `/me` 接口绕过用户状态检查

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L311-L370)

**描述**: `/api/bff/auth/me` 接口自行解析JWT但不调用 `authenticate` 中间件，因此不检查：
- 用户是否被锁定 (`account_locked`)
- 用户是否被注销 (`is_active`)

**风险等级**: 🟠 HIGH

**影响**: 即使管理员锁定了某用户，该用户已签发的JWT（7天有效）仍可调用 `/me` 接口获取信息。

**建议**: 在 `/me` 接口中也查询用户状态，或直接复用 `authenticate` 中间件。

---

### H-05: Helmet CSP被明确禁用

**文件**: [bff/src/index.js](bff/src/index.js#L48-L50)

**描述**:
```javascript
app.use(helmet({
  contentSecurityPolicy: false  // ← CSP被明确禁用！
}));
```

**风险等级**: 🟠 HIGH

**影响**: Content-Security-Policy是防御XSS的关键HTTP头。禁用它意味着即使前端存在XSS漏洞，浏览器也无法通过CSP策略阻止恶意脚本执行。

**建议**: 配置合适的CSP策略，至少 `default-src 'self'`。

---

### H-06: 全局Gitea代理路由无白名单限制（SSRF风险）

**文件**: [bff/src/routes/gitea.js](bff/src/routes/gitea.js#L281-L342)

**描述**: 通配符路由 `/*` 将所有HTTP方法和路径透传到Gitea API，无任何路径白名单或请求体校验：
```javascript
router.all('/*', authenticate, async (req, res, next) => {
  let giteaUrl = `${config.gitea.url}/api/v1${req.path}`;  // 用户完全可控
  fetchOptions.body = JSON.stringify(req.body);              // 直接透传
```

**风险等级**: 🟠 HIGH

**影响**: 虽需认证，但攻击者可通过此代理调用Gitea的任意API（包括管理API），绕过BFF的权限控制层。

**建议**: 使用白名单限制可代理的Gitea API路径和方法。

---

### H-07: 数据库SSL禁用且TLS证书验证被跳过

**文件**: [bff/src/database/connection.js](bff/src/database/connection.js#L200) / [docker-compose.yml](docker-compose.yml#L33)

**描述**:
```javascript
ssl: config.database.ssl ? { rejectUnauthorized: false } : false,  // SSL默认关闭；开启也不验证证书
```

**风险等级**: 🟠 HIGH

**影响**: 数据库连接默认不使用SSL，即使开启也跳过TLS证书验证（`rejectUnauthorized: false`），使连接容易受到中间人攻击。

**建议**: 生产环境强制启用SSL并验证证书。

---

### H-08: 部门隔离中间件定义但从未使用

**文件**: [bff/src/middleware/deptIsolation.js](bff/src/middleware/deptIsolation.js#L1-L15)

**描述**: `deptIsolation` 中间件已定义并导出，但在 `index.js` 和所有路由文件中从未被导入或使用。这意味着BFF层完全没有基于部门的数据隔离，仅依赖各路由中手动实现的过滤逻辑（且不同路由实现不一致）。

**风险等级**: 🟠 HIGH

**影响**: 不同部门的用户可能通过某些缺少手动过滤的路由访问到其他部门的数据。

**建议**: 将部门隔离中间件全局应用或确保每个路由都实现了部门过滤。

---

### H-09: 两个权限中间件存在管理员检测不一致

**文件**: 
- [bff/src/middleware/auth.js](bff/src/middleware/auth.js#L96-L98) — `requireAdmin` 检查 `roleCode === 'admin'`
- [bff/src/middleware/permission.js](bff/src/middleware/permission.js#L20) — `permissionMiddleware` 检查 `roleCode === '系统管理员'`

**描述**: `auth.js` 使用角色代码 `'admin'` 识别管理员，而 `permission.js` 使用中文显示名 `'系统管理员'`。后者永远不会匹配数据库中的 `role_code` 值。

**风险等级**: 🟠 HIGH

**影响**: 如果将来启用了 `permissionMiddleware`，管理员将无法通过其权限检查（因为 `roleCode` 存储的是 `'admin'` 而非 `'系统管理员'`）。

**建议**: 统一使用角色代码进行比较。

---

### H-10: JWT签发后无法撤销（无黑名单/版本号机制）

**文件**: [bff/src/middleware/auth.js](bff/src/middleware/auth.js#L8-L54) / [bff/src/routes/auth.js](bff/src/routes/auth.js#L300-L308)

**描述**: 
- 登出时仅删除 `sessions` 表记录，JWT本身在7天有效期内继续有效
- `authenticate` 中间件验证JWT时不查询 `sessions` 表
- 密码修改/重置后未使旧JWT失效

**风险等级**: 🟠 HIGH

**影响**: 被盗的JWT在有效期内无法被撤销；用户修改密码后旧令牌仍可使用。

**建议**: 实现JWT黑名单或使用令牌版本号（在 `user_profiles` 表中维护，`authenticate` 时校验）。

---

### H-11: Docker容器以root权限运行

**文件**: [bff/Dockerfile](bff/Dockerfile) / [front/Dockerfile](front/Dockerfile)

**描述**: 两个Dockerfile都没有 `USER` 指令，容器以root身份运行。BFF容器以root运行且有文件写入能力（`.env`, `.admin_token_cache`）。

**风险等级**: 🟠 HIGH

**影响**: 容器内代码执行漏洞可直接获得root权限，增加容器逃逸风险。

**建议**: 在Dockerfile中添加非root用户。

---

### H-12: 全站无HTTPS

**文件**: [bff/.env](bff/.env#L13) / [front/.env](front/.env#L6-L9) / [docker-compose.yml](docker-compose.yml#L34) / [front/nginx.conf](front/nginx.conf)

**描述**: 所有配置使用HTTP协议。Nginx仅监听80端口，无TLS配置。Gitea通信也是HTTP。所有认证凭据、JWT、源代码在网络上以明文传输。

**风险等级**: 🟠 HIGH

**影响**: 网络嗅探可获取所有传输数据，包括密码和源代码。

**建议**: 配置HTTPS/TLS；使用Let's Encrypt或内部CA签发证书。

---

### H-13: Nginx缺少所有安全响应头

**文件**: [front/nginx.conf](front/nginx.conf)

**描述**: Nginx配置中无任何安全头：`Strict-Transport-Security`、`X-Frame-Options`、`X-Content-Type-Options`、`X-XSS-Protection`、`Referrer-Policy`、`Permissions-Policy`。

**风险等级**: 🟠 HIGH

**影响**: 前端应用易受点击劫持、MIME嗅探等攻击。

**建议**: 添加标准安全响应头配置。

---

## 3. 中危问题 (MEDIUM)

### M-01: 暴力破解防护逻辑定义但未实现

**文件**: [bff/src/config/index.js](bff/src/config/index.js#L70-L72) / [bff/src/routes/auth.js](bff/src/routes/auth.js#L21-L101)

**描述**: 配置中定义了 `maxLoginAttempts: 5` 和 `lockoutDuration: 1800`，`user_profiles` 表也有 `failed_login_attempts` 和 `account_locked` 字段。但登录失败时从不递增计数、从不自动锁定账号。唯一防护是IP级别的速率限制（5次/分钟），可通过更换IP绕过。

**风险等级**: 🟡 MEDIUM

**建议**: 实现完整的账户锁定机制。

---

### M-02: 密码策略过弱（6位无复杂度要求）

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L103-L104) / [front/src/views/admin/users.vue](front/src/views/admin/users.vue#L300-L302)

**描述**: 密码仅要求不少于6位，无大写字母、小写字母、数字、特殊字符的组合要求。

**风险等级**: 🟡 MEDIUM

**建议**: 至少8位，包含大小写字母+数字+特殊字符中的三类。

---

### M-03: bcrypt轮数硬编码为10，无视配置

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L124) / [bff/src/config/index.js](bff/src/config/index.js#L68)

**描述**: 配置中 `security.bcryptRounds` 默认10，但在用户创建、密码重置、密码修改三处都硬编码了 `bcrypt.hash(password, 10)`，修改配置无效。

**风险等级**: 🟡 MEDIUM

**建议**: 使用 `config.security.bcryptRounds`；生产环境建议12+。

---

### M-04: 用户列表接口返回密码哈希等敏感字段

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L19-L27)

**描述**: 使用 `select('user_profiles.*')` 返回所有字段，包括 `password_hash`、`last_login_ip`。

**风险等级**: 🟡 MEDIUM

**建议**: 明确指定select字段列表，排除 `password_hash` 等敏感字段。

---

### M-05: 数据库连接失败时降级为内存模拟数据库

**文件**: [bff/src/database/connection.js](bff/src/database/connection.js#L240-L247) / [bff/src/index.js](bff/src/index.js#L199-L201)

**描述**: 数据库连接失败时自动切换到内存模拟数据库模式，而非终止启动。模拟数据库包含预设的管理员账号数据，所有安全控制退化。

**风险等级**: 🟡 MEDIUM

**建议**: 生产环境数据库连接失败时应终止启动并告警。

---

### M-06: express.urlencoded extended模式存在原型污染风险

**文件**: [bff/src/index.js](bff/src/index.js#L58)

**描述**:
```javascript
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**风险等级**: 🟡 MEDIUM

**建议**: 使用 `extended: false`（仅解析简单键值对）或使用最新版qs库。

---

### M-07: Docker端口绑定到所有接口

**文件**: [docker-compose.yml](docker-compose.yml#L9-L10) / [docker-compose.yml](docker-compose.yml#L22-L23)

**描述**: 两个服务都绑定到 `0.0.0.0`（默认），BFF的8080端口直接暴露给外部网络。

**风险等级**: 🟡 MEDIUM

**建议**: BFF服务仅通过内部Docker网络暴露给前端，不对外。

---

### M-08: `docker-compose.dev.yml` 挂载整个项目目录

**文件**: [docker-compose.dev.yml](docker-compose.dev.yml#L10-L11)

**描述**: `.env` 等包含真实凭据的文件被挂载到开发容器中。

**风险等级**: 🟡 MEDIUM

**建议**: 仅挂载必要的源代码目录。

---

### M-09: 登录错误消息可区分账号状态

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L97-L118)

**描述**: 登录接口返回三种不同的错误消息："用户名或密码错误"、"账号已注销"、"账号已被锁定"。攻击者可通过错误消息探测账号状态。

**风险等级**: 🟡 MEDIUM

**建议**: 统一返回"用户名或密码错误"，不透露账号状态。

---

### M-10: 密码修改接口无速率限制

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L429-L510)

**描述**: `/change-password` 接口无任何速率限制，攻击者可以暴力破解 `oldPassword` 字段。

**风险等级**: 🟡 MEDIUM

**建议**: 添加速率限制中间件。

---

### M-11: 前端token存储在JS可访问的sessionStorage中

**文件**: [front/src/api/index.js](front/src/api/index.js#L12-L17) / [front/src/stores/user.js](front/src/stores/user.js#L55-L59)

**描述**: JWT存储在 `sessionStorage` 中，可被同源JavaScript访问。结合XSS漏洞（H-01/H-02），token极易被窃取。

**风险等级**: 🟡 MEDIUM

**建议**: 使用httpOnly Secure SameSite Cookie存储token。

---

### M-12: `admin_token_cache` 文件未列入 `.gitignore`

**文件**: [bff/src/services/adminTokenCache.js](bff/src/services/adminTokenCache.js#L10)

**描述**: `.admin_token_cache` 缓存文件包含管理员Gitea凭据，但不在 `.gitignore` 中。

**风险等级**: 🟡 MEDIUM

**建议**: 将 `.admin_token_cache` 和 `*.cache` 加入 `.gitignore`。

---

## 4. 低危问题 (LOW)

### L-01: 备份功能未实现实际备份逻辑

**文件**: [bff/src/routes/backups.js](bff/src/routes/backups.js#L37-L77)

**描述**: 备份创建仅模拟进度更新（`setInterval` 递增百分比），不执行实际的数据库或文件备份。

**风险等级**: 🟢 LOW（功能性BUG）

**建议**: 实现实际备份逻辑或明确告知用户当前为占位功能。

---

### L-02: 仪表盘趋势数据为随机模拟数据

**文件**: [bff/src/routes/statistics.js](bff/src/routes/statistics.js#L162-L183)

**描述**: 趋势数据使用 `Math.random()` 生成，完全不反映真实情况。

**风险等级**: 🟢 LOW（功能性BUG）

**建议**: 从审计日志或Gitea API获取真实数据。

---

### L-03: 合规检查返回硬编码模拟结果

**文件**: [bff/src/routes/compliance.js](bff/src/routes/compliance.js#L10-L40)

**描述**: 所有合规检查（代码质量、敏感信息、依赖安全）始终返回通过状态，不执行任何实际检查。

**风险等级**: 🟢 LOW（功能性BUG）

**建议**: 实现实际合规检查或移除该功能入口。

---

### L-04: 遗留登录页面使用localStorage存储模拟token

**文件**: [front/src/views/login.vue](front/src/views/login.vue#L143) / [front/src/views/login.vue](front/src/views/login.vue#L169-L174)

**描述**: 存在废弃的 `login.vue`（实际使用的是 `login/index.vue`），其中使用 `localStorage` 存储模拟token。

**风险等级**: 🟢 LOW（死代码风险）

**建议**: 删除废弃的 `login.vue`。

---

### L-05: 错误处理器在生产环境返回原始错误消息

**文件**: [bff/src/middleware/errorHandler.js](bff/src/middleware/errorHandler.js#L29-L32)

**描述**: 500错误返回 `err.message`，可能泄露数据库错误、文件路径等内部信息。

**风险等级**: 🟢 LOW

**建议**: 生产环境500错误返回通用消息，详细信息仅记录日志。

---

### L-06: 大量静默try-catch吞没安全关键错误

**文件**: 多个文件（auth.js、users.js、gitea.js等）

**描述**: 关键安全检查（用户状态、权限校验）失败时使用空catch块静默忽略，可能导致已锁定用户仍能登录。

**风险等级**: 🟢 LOW

**建议**: 至少记录错误日志；对安全关键操作，失败时默认拒绝。

---

### L-07: 统计接口暴露服务器详细信息

**文件**: [bff/src/routes/statistics.js](bff/src/routes/statistics.js#L186-L268)

**描述**: `/system` 接口返回主机名、OS、CPU型号、Node版本、内存/磁盘使用、Gitea和数据库地址。虽需认证，但为攻击者提供了有价值的侦察信息。

**风险等级**: 🟢 LOW

**建议**: 添加管理员权限要求，或减少暴露的信息量。

---

### L-08: axios版本存在已知CVE

**文件**: [front/package.json](front/package.json)

**描述**: 使用的 axios 1.6.0 存在 CVE-2023-45857（跨域重定向可泄露token）。

**风险等级**: 🟢 LOW

**建议**: 升级axios到1.7.x+。

---

## 5. 总结与统计

### 按严重级别统计

| 级别 | 数量 | 占比 |
|------|------|------|
| 🔴 CRITICAL（严重） | 9 | 21% |
| 🟠 HIGH（高危） | 13 | 31% |
| 🟡 MEDIUM（中危） | 12 | 29% |
| 🟢 LOW（低危） | 8 | 19% |
| **总计** | **42** | **100%** |

### 按类别统计

| 类别 | 数量 | 典型问题 |
|------|------|----------|
| 认证与授权 | 11 | JWT嵌入密码、路由无认证、越权修改角色 |
| 凭据管理 | 7 | 硬编码密码、明文缓存、凭据写回配置文件 |
| 数据安全 | 6 | 审计日志记录密码、用户列表泄露hash、明文传输 |
| 输入/输出安全 | 6 | XSS(v-html)、CSP禁用、SSRF风险 |
| 配置与部署 | 7 | 无HTTPS、容器root运行、安全头缺失 |
| 功能缺陷 | 5 | 备份/趋势/合规为模拟数据、权限中间件不一致 |

### 优先修复路线图

| 优先级 | 问题编号 | 说明 |
|--------|----------|------|
| **P0 — 立即** | C-01, C-02, C-03 | 轮换所有凭据；修复无认证路由；从JWT中移除Gitea密码 |
| **P0 — 立即** | C-04, C-05, C-06 | 修复越权漏洞；审计日志脱敏 |
| **P1 — 本周** | H-01, H-02, H-03 | XSS漏洞修复；Token传输方式改进 |
| **P1 — 本周** | H-04~H-07, H-11~H13 | 用户状态检查；CSP配置；HTTPS部署 |
| **P2 — 本迭代** | M-01~M-06, M-09~M-11 | 暴力破解防护；密码策略；降级策略 |
| **P3 — 下迭代** | M-07~M-08, M-12, L-01~L-08 | 安全加固；依赖升级；功能完善 |

---

> **声明**: 本报告基于2026-07-13的代码静态审查生成，由4个并行审查代理交叉验证，仅包含已发现的问题。未包含运行时渗透测试（DAST）、模糊测试或第三方依赖供应链审计。建议建立定期安全审查机制和SDL（安全开发生命周期）流程。
