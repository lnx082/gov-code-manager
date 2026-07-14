/**
 * 前端统一配置入口
 *
 * 【功能】集中管理外部服务地址，所有模块通过 @/config 导入
 *        部署时只需修改 .env 文件中的 VITE_* 变量即可适配不同环境
 * 【数据】API_BASE_URL（BFF 地址）、GITEA_URL（Gitea 地址）
 * 【来源】import.meta.env.VITE_* 环境变量（来自 .env / .env.production）
 */

// BFF API 基地址（前端所有 API 请求的目标地址）
// 开发环境走 Vite 代理则用相对路径 /api/bff，否则需指向 BFF 实际地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/bff'

// Gitea 服务 HTTP 地址
export const GITEA_URL = import.meta.env.VITE_GITEA_URL || 'http://localhost:3000'

// 从 GITEA_URL 自动解析出主机名（用于 SSH 连接）
export const GITEA_SSH_HOST = (() => {
  try {
    const u = new URL(GITEA_URL)
    return u.hostname
  } catch {
    return 'localhost'
  }
})()

// 从 GITEA_URL 自动解析出主机名:端口（用于 HTTP 直连）
export const GITEA_HTTP_HOST = (() => {
  try {
    const u = new URL(GITEA_URL)
    return u.host
  } catch {
    return 'localhost:3000'
  }
})()
