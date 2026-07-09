import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, getUserInfo as getUserInfoApi, logout as logoutApi } from '@/api/user'
import Cookies from 'js-cookie'

export const useUserStore = defineStore('user', () => {
  const token = ref(Cookies.get('gitea_token') || '')
  const userInfo = ref(null)
  const permissions = ref([])

  const isAuthenticated = computed(() => !!token.value)
  
  const username = computed(() => userInfo.value?.username || userInfo.value?.nickname || '未登录')
  const roleName = computed(() => {
    const roleMap = {
      'admin': '系统管理员',
      'project_manager': '项目管理员',
      'developer': '开发人员',
      'auditor': '审计人员',
      'user': '普通用户'
    }
    return roleMap[userInfo.value?.role] || userInfo.value?.roleName || '普通用户'
  })

  async function initUser() {
    if (token.value) {
      try {
        const res = await getUserInfoApi()
        userInfo.value = res.data
        permissions.value = res.data.permissions || []
      } catch (error) {
        console.error('获取用户信息失败', error)
        logout()
      }
    }
  }

  async function loginAction(loginName, password) {
    const res = await loginApi(loginName, password)
    token.value = res.data.token
    Cookies.set('gitea_token', res.data.token, { expires: 7 })
    userInfo.value = res.data.user
    permissions.value = res.data.user.permissions || []
    return res
  }

  function logout() {
    try {
      logoutApi()
    } catch (e) {
      // 忽略错误
    }
    token.value = ''
    userInfo.value = null
    permissions.value = []
    Cookies.remove('gitea_token')
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
    roleName,
    initUser,
    loginAction,
    logout,
    hasPermission
  }
})
