/**
 * 内存缓存管理员 Gitea Token（纯内存，不落盘）
 * 用于在后端以管理员身份调用 Gitea API 获取全量仓库列表
 *
 * 安全说明：不再将凭据写入磁盘文件（C-09 修复）。
 * 服务重启后缓存自动失效，需重新从 config.gitea.token 加载。
 */
let cachedAdminToken = null;
let cachedAt = 0;
const TTL = 24 * 60 * 60 * 1000; // 24 小时（C-09：从 365 天缩短）

export function setCachedAdminToken(token) {
  if (!token) return;
  cachedAdminToken = token;
  cachedAt = Date.now();
}

export function getCachedAdminToken() {
  if (cachedAdminToken && (Date.now() - cachedAt) < TTL) {
    return cachedAdminToken;
  }
  return null; // 过期或未缓存，调用方应从 config.gitea.token 回退
}
