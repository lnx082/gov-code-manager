/**
 * 前端统一配置（所有 URL 从环境变量读取，不再硬编码）
 * Vite 环境变量文档: https://vitejs.dev/guide/env-and-mode.html
 */

// BFF API 地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/bff'

// Gitea 服务地址（HTTP，Git 操作 + API 代理）
export const GITEA_URL = import.meta.env.VITE_GITEA_URL || 'http://localhost:3000'

// Gitea SSH 主机（从 GITEA_URL 解析）
export const GITEA_SSH_HOST = (() => {
  try {
    const u = new URL(GITEA_URL)
    return u.hostname
  } catch {
    return 'localhost'
  }
})()

// Gitea HTTP 主机（含端口）
export const GITEA_HTTP_HOST = (() => {
  try {
    const u = new URL(GITEA_URL)
    return u.host
  } catch {
    return 'localhost:3000'
  }
})()
