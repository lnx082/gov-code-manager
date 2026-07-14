/**
 * 服务端凭据存储 — 将 Gitea 认证凭据保留在服务端内存，不放入 JWT
 *
 * C-03 修复：JWT payload 中不再携带 Gitea Basic Auth 凭据。
 * 登录时凭据存入此 Map，认证中间件自动注入到 req.user.giteaToken，
 * 所有下游路由无需修改即可继续使用 req.user.giteaToken。
 *
 * 服务重启后缓存清空，用户需重新登录。
 */
const credentialStore = new Map(); // userId (number) → giteaToken (string)

export function setCredential(userId, giteaToken) {
  if (!userId || !giteaToken) return;
  credentialStore.set(userId, giteaToken);
}

export function getCredential(userId) {
  return credentialStore.get(userId) || null;
}

export function removeCredential(userId) {
  credentialStore.delete(userId);
}
