/**
 * 持久化缓存管理员 Gitea Token（存磁盘 + 内存双写）
 * 用于在后端以管理员身份调用 Gitea API 获取全量仓库列表
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '..', '..', '.admin_token_cache');

let cachedAdminToken = null;
let cachedAt = 0;
const TTL = 365 * 24 * 60 * 60 * 1000; // 365 天（Basic Auth 不自动过期）

// 启动时从磁盘恢复
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (data.token && data.ts && (Date.now() - data.ts) < TTL) {
      cachedAdminToken = data.token;
      cachedAt = data.ts;
      console.log('[AdminTokenCache] 从磁盘恢复管理员 token');
    }
  }
} catch (e) { /* ignore */ }

function persist() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ token: cachedAdminToken, ts: cachedAt }), 'utf8');
  } catch (e) { /* ignore */ }
}

export function setCachedAdminToken(token) {
  if (!token) return;
  cachedAdminToken = token;
  cachedAt = Date.now();
  persist();
}

export function getCachedAdminToken() {
  if (cachedAdminToken && (Date.now() - cachedAt) < TTL) {
    return cachedAdminToken;
  }
  // 过期了，尝试重新从磁盘读取（可能被其他进程更新）
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (data.token && data.ts && (Date.now() - data.ts) < TTL) {
        cachedAdminToken = data.token;
        cachedAt = data.ts;
        return cachedAdminToken;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}
