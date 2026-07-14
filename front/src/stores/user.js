/**
 * 用户状态管理（认证/权限/登录/登出）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, getUserInfo as getUserInfoApi, logout as logoutApi } from '@/api/user'
import { getToken, setToken, removeToken } from '@/api'

export const useUserStore = defineStore('user', () => {
  // 使用 sessionStorage 存储 token，实现标签页独立登录
  const token = ref(getToken())
  const userInfo = ref(null)
  const permissions = ref([])

  const isAuthenticated = computed(() => !!token.value)

  const username = computed(() => userInfo.value?.username || userInfo.value?.nickname || '未登录')
  const role = computed(() => userInfo.value?.role || '')
  const roleName = computed(() => {
    const roleMap = {
      'admin': '系统管理员',
      'project_manager': '项目管理员',
      'developer': '开发人员',
      'auditor': '审计人员',
      'security_auditor': '审计人员'
    }
    return roleMap[userInfo.value?.role] || userInfo.value?.roleName || '开发人员'
  })

  // 审计角色判断（数据库可能为 auditor 或 security_auditor）
  const isAuditor = computed(() => {
    const r = userInfo.value?.role || ''
    return r === 'auditor' || r === 'security_auditor'
  })

  async function initUser() {
    if (token.value) {
      try {
        const res = await getUserInfoApi()
        userInfo.value = res.data
        permissions.value = res.data.permissions || []
        console.log('[UserStore] initUser 完成 — role:', userInfo.value?.role, 'permissions:', permissions.value)
      } catch (error) {
        console.error('获取用户信息失败', error)
        logout()
      }
    }
  }

  async function loginAction(loginName, password) {
    const res = await loginApi(loginName, password)
    token.value = res.data.token
    setToken(res.data.token)
    // C-03 修复：JWT 不再携带 Gitea 凭据，由 BFF credentialStore 管理
    userInfo.value = res.data.user
    permissions.value = res.data.user.permissions || []
    return res
  }

  async function logout() {
    try {
      await logoutApi()
    } catch (e) {
      // 忽略错误
    }
    token.value = ''
    userInfo.value = null
    permissions.value = []
    removeToken()
  }

  function hasPermission(permission) {
    // 管理员拥有所有权限
    if (userInfo.value?.role === 'admin') return true
    return permissions.value.includes(permission) || permissions.value.some(p => p.endsWith('*') && permission.startsWith(p.slice(0, -1)))
  }

  return {
    token,
    userInfo,
    permissions,
    isAuthenticated,
    username,
    role,
    roleName,
    isAuditor,
    initUser,
    loginAction,
    logout,
    hasPermission
  }
})
