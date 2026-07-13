/**
 * Axios 实例创建 + 请求/响应拦截器（BFF + Gitea 双通道）
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { API_BASE_URL } from '@/config'

// token 存储工具 — 使用 sessionStorage 实现标签页独立登录
const TOKEN_KEY = 'gitea_token'
const API_TOKEN_KEY = 'gitea_api_token'

function getToken() { return sessionStorage.getItem(TOKEN_KEY) || '' }
function setToken(v) { sessionStorage.setItem(TOKEN_KEY, v) }
function removeToken() { sessionStorage.removeItem(TOKEN_KEY) }
function getApiToken() { return sessionStorage.getItem(API_TOKEN_KEY) || '' }
function setApiToken(v) { sessionStorage.setItem(API_TOKEN_KEY, v) }
function removeApiToken() { sessionStorage.removeItem(API_TOKEN_KEY) }

// 防止多个 401 并发重复跳转
let isRedirecting = false

// 统一的登录过期处理：清空 token 并跳转登录页
function handleUnauthorized() {
  if (isRedirecting) return
  isRedirecting = true
  removeToken()
  removeApiToken()
  // 检查是否已在登录页
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  } else {
    isRedirecting = false
  }
}

// 创建 BFF API 实例
const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - BFF
service.interceptors.request.use(
  config => {
    const token = getToken()
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
          handleUnauthorized()
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
  baseURL: API_BASE_URL + '/gitea',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Gitea 请求拦截器 — 通过 BFF 代理访问 Gitea，发送 JWT Token
giteaService.interceptors.request.use(
  config => {
    const jwtToken = getToken()
    if (jwtToken) {
      config.headers['Authorization'] = `Bearer ${jwtToken}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Gitea 响应拦截器 — 拦截 401 清除过期 token
giteaService.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      handleUnauthorized()
    }
    return Promise.reject(error)
  }
)

export { giteaService }

// BFF Service 别名（与默认导出相同的实例）
export const bffService = service

// 暴露 token 工具给 store 使用
export { getToken, setToken, removeToken, getApiToken, setApiToken, removeApiToken }
