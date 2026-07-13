# 党政软件版本管控平台 — 安全漏洞与BUG审查报告

> **审查日期**: 2026-07-13
> **审查范围**: 全项目（BFF后端 + Vue前端 + 配置文件 + Docker部署）
> **审查方式**: 静态代码审查，仅发现问题，不做修复
> **审查人**: AI 安全审查

---

## 目录

1. [严重漏洞 (CRITICAL)](#1-严重漏洞-critical)
2. [高危漏洞 (HIGH)](#2-高危漏洞-high)
3. [中危问题 (MEDIUM)](#3-中危问题-medium)
4. [低危问题 (LOW)](#4-低危问题-low)
5. [总结与统计](#5-总结与统计)

---

## 1. 严重漏洞 (CRITICAL)

### C-01: 硬编码数据库密码和JWT密钥

**文件**: [bff/src/config/index.js](bff/src/config/index.js#L29) / [bff/src/config/index.js](bff/src/config/index.js#L43) / [docker-compose.yml](docker-compose.yml#L32)

**描述**: 配置文件中存在多处硬编码的敏感凭据：

```javascript
// config/index.js:29
password: process.env.DB_PASSWORD || 'Besti@2026_db',

// config/index.js:43
secret: process.env.JWT_SECRET || 'gov_code_manager_jwt_secret_key_2024_secure',
```

```yaml
# docker-compose.yml:32
- DB_PASSWORD=${DB_PASSWORD:-Besti@2026_db}
# docker-compose.yml:36
- JWT_SECRET=${JWT_SECRET:-gov_code_manager_jwt_secret_key_2024_secure}
```

**风险等级**: 🔴 CRITICAL

**影响**: 任何人拿到源代码即可获得数据库密码和JWT签名密钥。攻击者可以：
- 直接连接数据库窃取/篡改所有数据
- 伪造任意用户的JWT令牌，以管理员身份登录系统
- 这些默认值在docker-compose.yml中再次硬编码，即使修改了.env也会在Docker部署时被默认值覆盖

**建议修复方向**: 移除所有默认值，启动时强制要求环境变量；生产环境使用密钥管理服务。

---

### C-02: 开发环境JWT密钥降级为弱密钥

**文件**: [bff/src/config/index.js](bff/src/config/index.js#L110-L114)

**描述**:
```javascript
if (config.nodeEnv === 'development') {
  config.jwt.secret = 'dev_jwt_secret_do_not_use_in_production';
  // ...
}
```

**风险等级**: 🔴 CRITICAL

**影响**: 开发环境下JWT密钥被强制覆盖为极易猜测的字符串。如果开发配置被误部署到生产环境（`NODE_ENV`未正确设置），整个认证体系立即失效。

**建议修复方向**: 开发环境也应从环境变量读取JWT密钥，或使用随机生成的临时密钥。

---

### C-03: JWT中嵌入Gitea Basic Auth凭据（严重敏感信息泄露）

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L256-L270) / [front/src/stores/user.js](front/src/stores/user.js#L55-L59)

**描述**: 登录时，用户的Gitea用户名和密码被编码为Basic Auth凭证，直接嵌入JWT token的payload中：

```javascript
// auth.js:256-270
const token = jwt.sign({
  userId: giteaUser.id,
  username: giteaUser.login || username,
  // ...
  giteaToken: giteaToken || '',  // ← Basic Auth: base64(username:password)
}, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
```

前端从JWT中提取此凭证存储在sessionStorage中：

```javascript
// stores/user.js:55-59
const payload = JSON.parse(atob(res.data.token.split('.')[1]))
if (payload.giteaToken) {
  setApiToken(payload.giteaToken)
}
```

**风险等级**: 🔴 CRITICAL

**影响**: 
- JWT的payload部分仅Base64编码，不加密，任何获取到JWT的人可以直接解码看到Gitea凭证
- JWT在每次API请求中通过`Authorization`头传输，网络抓包即可获取
- XSS攻击可以轻易读取sessionStorage中的token
- 这等于把用户的Gitea密码以近乎明文的方式在前后端之间传输

**建议修复方向**: 使用Gitea Access Token替代Basic Auth，token仅在服务端存储，前端使用独立的session标识符。

---

### C-04: 用户信息更新路由缺少管理员权限校验（IDOR漏洞）

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L221-L259)

**描述**:
```javascript
// 更新用户 — 仅检查了 authenticate，没有 requireAdmin！
router.put('/:id', authenticate, async (req, res, next) => {
  // checkNotAdmin 只防止修改admin用户，其他用户无限制
  await checkNotAdmin(id);
  const { nickname, role_code, department_id, is_active, email, secret_level } = req.body;
  // 任意登录用户可以修改任意其他用户的角色、部门、状态！
  await db('user_profiles').where('user_id', id).update(updateData);
});
```

**风险等级**: 🔴 CRITICAL

**影响**: 任何已登录的普通用户可以通过此接口：
- 将自己的`role_code`修改为`admin`，获得系统管理员权限
- 修改任意其他用户的角色、部门、激活状态
- 这是典型的IDOR（不安全的直接对象引用）+ 越权漏洞

**建议修复方向**: 添加`requireAdmin`中间件或限制用户只能修改自己的信息。

---

### C-05: 系统配置更新路由缺少管理员权限校验

**文件**: [bff/src/routes/system.js](bff/src/routes/system.js#L27-L53)

**描述**:
```javascript
// 更新系统配置 — 仅 authenticate，无 requireAdmin！
router.put('/config', authenticate, async (req, res, next) => {
  const { configs } = req.body;
  for (const [key, value] of Object.entries(configs)) {
    // 任意登录用户可以修改系统配置
  }
});
```

**风险等级**: 🔴 CRITICAL

**影响**: 任何登录用户可以修改系统配置，可能影响全系统行为。

**建议修复方向**: 添加`requireAdmin`中间件。

---

### C-06: SQL注入漏洞 — 表名和列名拼接

**文件**: [bff/src/database/connection.js](bff/src/database/connection.js#L74-L81)

**描述**:
```javascript
const result = await database.raw(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = '${tableName}' AND column_name = '${col.name}'
`);
// ...
await database.raw(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.def}`);
```

**风险等级**: 🔴 CRITICAL

**影响**: 虽然`tableName`和`col.name`来自硬编码的`tableColumns`映射，但若未来扩展允许外部传入表名，则存在SQL注入风险。更严重的是`col.def`字段包含默认值字符串（如`'BOOLEAN DEFAULT FALSE'`），虽当前安全但架构上不健壮。这属于SQL注入的技术债务，当前利用可能性低但需修复。

**建议修复方向**: 使用参数化查询或对标识符进行严格的格式校验。

---

## 2. 高危漏洞 (HIGH)

### H-01: Token通过URL查询参数传递

**文件**: [bff/src/middleware/auth.js](bff/src/middleware/auth.js#L15-L17)

**描述**:
```javascript
} else if (req.query.token) {
  token = req.query.token;  // 从URL参数中提取token
}
```

**风险等级**: 🟠 HIGH

**影响**: Token出现在URL中会被记录在：
- 服务器访问日志
- 浏览器历史记录
- 代理/负载均衡日志
- Referer头中传递给第三方

**建议修复方向**: 仅使用Authorization头传递token，下载场景使用一次性短期token。

---

### H-02: 审计日志记录敏感请求体

**文件**: [bff/src/middleware/audit.js](bff/src/middleware/audit.js#L125-L126)

**描述**:
```javascript
request_body: JSON.stringify(req.body || {}).substring(0, 4000),
```

**风险等级**: 🟠 HIGH

**影响**: 所有请求体（包括登录密码、修改密码的旧密码/新密码、token等）都会被完整记录到审计日志的`request_body`字段中。虽然截断到4000字符，但密码等敏感信息在审计日志表中以明文存储。这是一个严重的数据泄露和合规风险。

**建议修复方向**: 在记录审计日志前，对敏感字段（password、oldPassword、newPassword、token等）进行脱敏处理。

---

### H-03: XSS漏洞 — v-html渲染来自Gitea的内容

**文件**: 
- [front/src/views/versions/index.vue](front/src/views/versions/index.vue#L151)
- [front/src/views/repos/detail.vue](front/src/views/repos/detail.vue#L150)
- [front/src/views/repos/detail.vue](front/src/views/repos/detail.vue#L181)

**描述**:
```html
<!-- 直接渲染Gitea返回的HTML内容 -->
<div class="release-body" v-html="activeVersion.release.body_html || activeVersion.release.body"></div>
<div v-html="renderDiffLines(f.lines)"></div>
<div class="release-body" v-html="tagDetail.release.body_html || tagDetail.release.body || '无'"></div>
```

**风险等级**: 🟠 HIGH

**影响**: Gitea的release body和body_html字段可能包含恶意脚本。如果攻击者能够向Gitea仓库提交包含恶意HTML/JS的release内容（如`<img src=x onerror=alert(document.cookie)>`），这些内容会在其他用户浏览版本详情时执行。

**建议修复方向**: 使用DOMPurify等库对HTML内容进行白名单过滤；或在渲染前进行HTML实体编码。

---

### H-04: 审计日志`/me`接口重复认证逻辑绕过

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L311-L370)

**描述**: `/api/bff/auth/me`接口自行从请求头解析JWT并验证，但**没有调用`authenticate`中间件**，因此：
- 不检查用户是否被锁定（`account_locked`）
- 不检查用户是否被注销（`is_active`）
- 只验证JWT签名，不查询用户状态

```javascript
router.get('/me', async (req, res, next) => {
  const token = authHeader.substring(7);
  decoded = jwt.verify(token, config.jwt.secret);
  // 直接使用decoded信息，不检查用户状态
});
```

**风险等级**: 🟠 HIGH

**影响**: 即使管理员锁定了某用户的账号，该用户的JWT（在签发后7天内）仍可用于`/me`接口获取信息。虽然不能执行需要`authenticate`中间件的操作，但信息泄露本身已是风险。

**建议修复方向**: 在`/me`接口中也检查用户状态，或统一使用`authenticate`中间件。

---

### H-05: 管理员登录时自动写入Gitea凭据到.env文件

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L239-L253)

**描述**:
```javascript
if (isAdmin && !config.gitea?.token) {
  let envContent = fs.readFileSync(ENV_FILE, 'utf8');
  envContent = envContent.replace(/GITEA_ADMIN_TOKEN=.*/, `GITEA_ADMIN_TOKEN=${giteaToken}`);
  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
}
```

**风险等级**: 🟠 HIGH

**影响**:
- 管理员Basic Auth凭据以明文写入`.env`文件
- 文件写入操作可能因并发、权限问题导致`.env`文件损坏
- 如果`.env`被提交到版本控制（`.gitignore`配置不当），凭据立即泄露
- 若存在路径遍历漏洞，攻击者可能覆盖其他文件

**建议修复方向**: 使用独立的凭据存储机制（如数据库+加密、Vault等），不要直接修改配置文件。

---

### H-06: 全局代理路由缺少输入校验和SSRF风险

**文件**: [bff/src/routes/gitea.js](bff/src/routes/gitea.js#L281-L342)

**描述**: 通配符路由`/*`将所有请求透传到Gitea API，包括请求体和请求方法：
```javascript
router.all('/*', authenticate, async (req, res, next) => {
  const giteaPath = req.path;  // 用户完全可控
  let giteaUrl = `${config.gitea.url}/api/v1${giteaPath}`;
  
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);  // 透传请求体
  }
});
```

**风险等级**: 🟠 HIGH

**影响**:
- 攻击者可以构造特殊路径调用Gitea的管理API（虽然受authenticate限制，但某些Gitea API可能被滥用）
- 没有对请求体进行校验，可能存在批量操作、资源滥用等风险
- Gitea URL拼接若存在路径遍历，理论上可能触发SSRF

**建议修复方向**: 使用白名单限制可代理的Gitea API路径和方法，添加请求体大小/内容校验。

---

### H-07: CSRF保护缺失

**文件**: [bff/src/index.js](bff/src/index.js#L51-L56) / [bff/src/middleware/auth.js](bff/src/middleware/auth.js)

**描述**: 应用使用JWT Bearer Token进行认证，但没有实现CSRF保护：
- CORS配置允许跨域请求
- 没有CSRF Token机制
- 没有SameSite Cookie策略
- 没有Origin/Referer校验

```javascript
app.use(cors({
  origin: config.api.corsOrigins,
  credentials: true,  // 允许携带凭据
}));
```

**风险等级**: 🟠 HIGH

**影响**: 虽然JWT Bearer Token在请求头中，标准CSRF攻击无法直接窃取，但结合XSS漏洞时攻击面扩大。另外，CORS配置宽松（`credentials: true`配合多个origin），增加了跨域攻击风险。

**建议修复方向**: 添加CSRF Token机制，使用严格CORS策略，添加Origin/Referer校验。

---

### H-08: Helmet CSP被禁用

**文件**: [bff/src/index.js](bff/src/index.js#L48-L50)

**描述**:
```javascript
app.use(helmet({
  contentSecurityPolicy: false  // CSP被明确禁用！
}));
```

**风险等级**: 🟠 HIGH

**影响**: Content-Security-Policy是防御XSS攻击的关键HTTP头。禁用后：
- 内联脚本可以执行
- 恶意资源可以从任何域名加载
- 数据注入攻击更容易成功
- 前端使用了v-html，CSP本可以提供第二层防护

**建议修复方向**: 配置合适的CSP策略，至少设置`default-src 'self'`和`script-src`策略。

---

## 3. 中危问题 (MEDIUM)

### M-01: 密码强度要求过低

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L103-L104) / [bff/src/routes/users.js](bff/src/routes/users.js#L269-L274)

**描述**: 密码创建和修改仅要求"不少于6位"，没有复杂度要求：
```javascript
if (password.length < 6) {
  return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
}
```

**风险等级**: 🟡 MEDIUM

**影响**: 6位纯数字密码即可通过校验，暴力破解难度低。

**建议修复方向**: 要求至少8位，包含大写字母、小写字母、数字、特殊字符中的至少三类。

---

### M-02: 登录失败锁定机制不完整

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L21-L101)

**描述**: 
- 登录接口校验了`account_locked`状态
- 但登录失败时**没有增加`failed_login_attempts`计数**
- `locked_until`字段虽在用户创建时定义了，但登录失败逻辑中未使用
- 5次/分钟的速率限制是唯一的防暴力破解机制

**风险等级**: 🟡 MEDIUM

**影响**: 攻击者可以每分钟尝试5次密码，持续攻击直到成功。对于弱密码，这个速率仍足以在合理时间内破解。

**建议修复方向**: 实现完整的账户锁定机制：累计5次失败后锁定30分钟，记录IP，增加登录延迟。

---

### M-03: 密码修改后未清除所有旧会话

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L429-L510) / [bff/src/routes/auth.js](bff/src/routes/auth.js#L300-L308)

**描述**: 修改密码后：
- 旧JWT在有效期内仍可使用（7天）
- 只在登录时清除旧的session记录，但JWT是无状态的
- 密码重置（管理员操作）后也未使目标用户的旧JWT失效

**风险等级**: 🟡 MEDIUM

**影响**: 如果密码被泄露后用户修改了密码，已签发的旧JWT在7天内仍然有效，攻击者可以继续使用。

**建议修复方向**: 实现JWT黑名单或使用刷新令牌机制；密码修改后立即使所有现有令牌失效。

---

### M-04: 模拟数据库模式暴露默认管理员数据

**文件**: [bff/src/database/connection.js](bff/src/database/connection.js#L651-L680)

**描述**: 当数据库连接失败时，系统降级使用内存模拟数据库，其中包含预设的管理员账号数据。虽然模拟数据库不持久化，但降级模式本身就是一种安全退化。

**风险等级**: 🟡 MEDIUM

**影响**: 如果生产环境数据库短暂不可用，BFF自动切换到模拟模式，所有认证和权限检查退化到模拟数据，安全体系实质失效。

**建议修复方向**: 生产环境不应启用模拟数据库降级，数据库连接失败时应终止启动并告警。

---

### M-05: 用户列表泄露敏感信息

**文件**: [bff/src/routes/users.js](bff/src/routes/users.js#L14-L68)

**描述**: 获取用户列表接口返回了`user_profiles`的所有字段（使用`*`），包括：
- `password_hash`（虽然经过bcrypt哈希，但仍不应暴露）
- `secret_level`
- `role_code`
- `last_login_ip`

```javascript
let query = db('user_profiles')
  .select('user_profiles.*', // ← 返回所有字段
    'roles.name as role_name',
    'departments.name as department_name')
```

**风险等级**: 🟡 MEDIUM

**影响**: 密码哈希泄露后可能被离线破解（尽管bcrypt安全性较高）；IP地址泄露用户位置信息。

**建议修复方向**: 明确指定`select`字段列表，排除`password_hash`、`last_login_ip`等敏感字段。

---

### M-06: 部门隔离中间件仅需角色绕过

**文件**: [bff/src/middleware/deptIsolation.js](bff/src/middleware/deptIsolation.js#L5-L8)

**描述**:
```javascript
if (req.user?.roleCode === 'admin' || req.user?.roleCode === 'project_manager') {
  return next();  // 直接跳过部门隔离
}
```

**风险等级**: 🟡 MEDIUM

**影响**: `project_manager`角色也完全跳过了部门隔离。这意味着项目管理员可以看到所有部门的数据，而不仅仅是自己部门的数据。这可能是设计意图，但权限过于宽泛——项目管理员本应只管理自己的项目。

**建议修复方向**: 项目管理员也应受部门限制，或设计更细粒度的跨部门访问控制。

---

### M-07: 登录接口异常处理信息泄露

**文件**: [bff/src/routes/auth.js](bff/src/routes/auth.js#L39-L41)

**描述**: Gitea认证失败时，详细的错误信息被记录到控制台，且区分了"Gitea认证请求异常"和"用户名或密码错误"两种情况。虽然对用户返回统一错误信息，但服务端日志包含过多细节。

```javascript
try {
  giteaUser = await authenticateWithGitea(username, password);
} catch (giteaErr) {
  console.warn('Gitea 认证请求异常，尝试本地认证:', giteaErr.message);
}
```

**风险等级**: 🟡 MEDIUM

**影响**: 攻击者如果能访问服务端日志（通过日志文件、日志聚合系统等），可以区分"用户名不存在"和"密码错误"两种状态。

**建议修复方向**: 减少日志中对认证失败细节的记录，使用统一的错误处理。

---

### M-08: express.urlencoded extended模式安全风险

**文件**: [bff/src/index.js](bff/src/index.js#L58)

**描述**:
```javascript
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**风险等级**: 🟡 MEDIUM

**影响**: `extended: true`使用`qs`库解析嵌套对象，存在原型污染攻击风险（历史CVE）。10MB的body限制也可能被用于DoS攻击。

**建议修复方向**: 使用`extended: false`（querystring库解析，不支持嵌套），或使用更新版本的qs库；降低body大小限制。

---

## 4. 低危问题 (LOW)

### L-01: 多个try-catch静默吞没错误

**文件**: 多个文件

**描述**: 代码中大量使用空的catch块，包括关键的安全检查：

```javascript
// auth.js:39
} catch { /* 查询失败不影响正常请求 */ }

// auth.js:67
} catch { /* 静默失败，用本地数据 */ }

// auth.js:120
} catch { /* 忽略查询错误 */ }

// auth.js:216
} catch { /* 忽略 */ }
```

**风险等级**: 🟢 LOW

**影响**: 
- 安全相关的数据库查询失败时静默忽略（如用户状态检查）
- 可能导致已锁定用户登录、已注销用户访问等安全问题
- 故障排查困难

**建议修复方向**: 至少记录错误日志，区分"可忽略"和"必须处理"的错误场景。

---

### L-02: 统计接口返回服务器系统信息

**文件**: [bff/src/routes/statistics.js](bff/src/routes/statistics.js#L186-L268)

**描述**: `/api/bff/statistics/system`接口返回服务器的详细信息：
```javascript
res.json({
  code: 200,
  data: {
    hostname: os.hostname(),     // 主机名
    platform: os.platform(),     // 操作系统
    arch: os.arch(),             // 架构
    nodeVersion: process.version, // Node版本
    uptime: Math.floor(os.uptime()), // 运行时间
    cpu: { model, cores, usage },
    memory: { total, used, free, usagePct },
    disk: { total, free, usagePct },
    services: {
      gitea: { url, online },    // Gitea服务地址
      database: { host, online }, // 数据库地址
    },
  },
});
```

**风险等级**: 🟢 LOW

**影响**: 向已登录用户暴露服务器内部信息，包括数据库和Gitea的连接地址。虽需要认证，但对攻击者的信息收集阶段有价值。

**建议修复方向**: 考虑是否需要暴露如此详细的系统信息，或添加管理员权限要求。

---

### L-03: 模拟趋势数据

**文件**: [bff/src/routes/statistics.js](bff/src/routes/statistics.js#L162-L183)

**描述**:
```javascript
// 生成模拟趋势数据
const data = [];
for (let i = 0; i < 7; i++) {
  data.unshift({
    date: date.toISOString().split('T')[0],
    commits: Math.floor(Math.random() * 50) + 10,
    versions: Math.floor(Math.random() * 5) + 1,
    approvals: Math.floor(Math.random() * 10) + 2,
  });
}
```

**风险等级**: 🟢 LOW

**影响**: 仪表盘趋势数据为完全随机的模拟数据，不具备真实参考价值。虽非安全漏洞，但属于功能性BUG——决策者基于虚假数据做出判断。

**建议修复方向**: 从审计日志或Gitea API获取真实趋势数据。

---

### L-04: 审计日志请求体未脱敏存储

**文件**: [bff/src/middleware/audit.js](bff/src/middleware/audit.js#L125)

**描述**: 已在H-02中详述。此处再次列出作为合规性提示：根据《个人信息保护法》和《数据安全法》，密码等个人敏感信息不应被记录到审计日志中。

---

### L-05: .env.example未包含GITEA_ADMIN_TOKEN配置项

**文件**: [.env.example](.env.example)

**描述**: `.env.example`缺少`GITEA_ADMIN_TOKEN`配置项说明，但代码中多处依赖此配置。管理员登录时会自动写入此配置，但新部署时可能遗漏。

**风险等级**: 🟢 LOW

**影响**: 新部署时可能忘记配置管理员Token，导致某些功能降级。

---

### L-06: 依赖项可能存在已知漏洞

**文件**: [bff/package.json](bff/package.json) / [front/package.json](front/package.json)

**描述**: 项目使用了一些已知曾有CVE的npm包（如`express`、`jsonwebtoken`、`knex`、`helmet`等）。未运行`npm audit`以验证当前使用的版本是否存在已知漏洞。

**风险等级**: 🟢 LOW（可能是HIGH，取决于具体版本）

**影响**: 如果使用了存在已知漏洞的依赖版本，整个应用面临风险。

**建议修复方向**: 运行`npm audit`检查前后端依赖，升级存在已知漏洞的包。

---

### L-07: Git仓库中包含敏感配置信息

**文件**: [.env](.env)

**描述**: `.env`文件包含：
- Gitea服务器IP: `123.60.219.19`
- 应用内部API地址

尽管`.env`不在`.gitignore`中，但当前仍在工作目录中。确认该IP是否为内网地址，如果是公网IP则存在信息泄露风险。

**风险等级**: 🟢 LOW

**影响**: 如果`.env`被意外提交到Git仓库，公网IP和服务端口将被暴露。

---

### L-08: 备份功能未实现实际备份逻辑

**文件**: [bff/src/routes/backups.js](bff/src/routes/backups.js#L37-L77)

**描述**: 备份创建接口仅模拟进度更新，没有实际执行数据库备份或文件备份操作：
```javascript
// 模拟备份过程
let progress = 0;
const interval = setInterval(async () => {
  progress += 25;
  // 仅更新进度字段，不执行实际备份
}, 1000);
```

**风险等级**: 🟢 LOW

**影响**: 功能性BUG — 虽有备份管理UI和管理功能，但实际备份操作未实现，用户可能误以为系统已备份。在灾难恢复场景下将是严重问题。

---

## 5. 总结与统计

### 按严重级别统计

| 级别 | 数量 | 占比 |
|------|------|------|
| 🔴 CRITICAL（严重） | 6 | 19% |
| 🟠 HIGH（高危） | 8 | 26% |
| 🟡 MEDIUM（中危） | 8 | 26% |
| 🟢 LOW（低危） | 9 | 29% |
| **总计** | **31** | **100%** |

### 按类别统计

| 类别 | 数量 | 典型问题 |
|------|------|----------|
| 认证与授权 | 8 | 硬编码密钥、JWT嵌入密码、权限绕过 |
| 数据安全 | 7 | 审计日志泄露密码、用户列表返回hash、明文存储 |
| 输入验证 | 5 | SQL注入、XSS、SSRF、缺少校验 |
| 配置安全 | 5 | 默认密码、CSP禁用、模拟模式降级 |
| 会话管理 | 3 | JWT不过期、密码修改后session未失效 |
| 功能缺陷 | 3 | 备份未实现、趋势数据模拟、降级模式 |

### 优先修复建议

1. **立即修复 (C-01, C-02, C-03)**: 移除所有硬编码凭据，修复JWT中嵌入密码的问题
2. **本周修复 (C-04, C-05, H-02, H-03)**: 修复权限绕过漏洞和XSS漏洞
3. **本迭代修复 (H-04~H-08, M-01~M-03)**: 完善认证体系和输入校验
4. **下迭代修复 (M-04~M-08, L-01~L-08)**: 安全加固和功能完善

---

> **声明**: 本报告基于2026-07-13的代码静态审查生成，仅包含已发现的问题。未包含运行时的动态测试（DAST）、渗透测试或第三方依赖审计。建议定期进行安全审查并建立SDL（安全开发生命周期）流程。
