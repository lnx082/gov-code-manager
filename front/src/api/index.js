/**
 * Axios 实例创建 + 请求/响应拦截器（BFF + Gitea 双通道）
 */
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'
import Cookies from 'js-cookie'

// 创建 BFF API 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://123.60.219.19:8080/api/bff',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - BFF
service.interceptors.request.use(
  config => {
    const token = Cookies.get('gitea_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('请求错误', error)
    return Promise.reject(error)
  }
)

// 响应拦截器 - BFF
service.interceptors.response.use(
  response => {
    const res = response.data
    
    // 根据业务状态码判断
    if (res.code !== undefined && res.code !== 200 && res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    
    return res
  },
  error => {
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          ElMessageBox.confirm('登录已过期，请重新登录', '提示', {
            confirmButtonText: '重新登录',
            cancelButtonText: '取消',
            type: 'warning'
          }).then(() => {
            Cookies.remove('gitea_token')
            router.push('/login')
          })
          break
        case 403:
          ElMessage.error(data?.message || '没有权限访问该资源')
          break
        case 404:
          ElMessage.error(data?.message || '请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器内部错误，请联系管理员')
          break
        default:
          ElMessage.error(data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络连接失败，请检查网络')
    }
    
    return Promise.reject(error)
  }
)

// 导出统一的 API 方法
export default service
export { service }

// 创建 Gitea API 实例（通过 BFF 代理，避免跨域）
const giteaService = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/bff') + '/gitea',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Gitea 请求拦截器 — 通过 BFF 代理访问 Gitea，发送 JWT Token
giteaService.interceptors.request.use(
  config => {
    // 发送 JWT Token 给 BFF，BFF gitea.js 代理会提取 giteaToken 转发给 Gitea
    const jwtToken = Cookies.get('gitea_token')
    if (jwtToken) {
      config.headers['Authorization'] = `Bearer ${jwtToken}`
    }
    return config
  },
  error => Promise.reject(error)
)

export { giteaService }

// BFF Service 别名（与默认导出相同的实例）
export const bffService = service
