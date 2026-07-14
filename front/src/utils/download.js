/**
 * 下载工具 — 通过 BFF 获取 Gitea 下载 token，附加到 archive URL 避免重定向到登录页
 */
import { getDownloadToken } from '@/api/bff'
import { GITEA_URL } from '@/config'
import { ElMessage } from 'element-plus'

/**
 * 下载仓库 ZIP 归档
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} ref - 分支名或 tag 名
 * @param {Object} options
 * @param {string} options.filename - 下载文件名（可选，默认 {repo}-{ref}.zip）
 */
export async function downloadRepoArchive(owner, repo, ref, options = {}) {
  const { filename } = options

  try {
    // 1. 从 BFF 获取下载 token
    const res = await getDownloadToken()
    const token = res.data?.token

    if (!token) {
      ElMessage.error('获取下载令牌失败')
      return
    }

    // 2. 构造带 token 的下载 URL
    //    注意：必须用 Gitea API 路由（/api/v1/repos/.../archive），而非 Web 路由（/.../archive）
    //    Web 路由只认 Session Cookie，API 路由才支持 ?token= 参数
    const url = `${GITEA_URL}/api/v1/repos/${owner}/${repo}/archive/${ref}.zip?token=${encodeURIComponent(token)}`
    const downloadFilename = filename || `${repo}-${ref}.zip`

    // 3. 触发下载
    const a = document.createElement('a')
    a.href = url
    a.download = downloadFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (error) {
    console.error('下载失败:', error)
    // 降级：不带 token 直接下载（已登录 Gitea 的用户仍可成功）
    const url = `${GITEA_URL}/api/v1/repos/${owner}/${repo}/archive/${ref}.zip`
    window.open(url, '_blank')
  }
}
