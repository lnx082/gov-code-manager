import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repos',
    name: 'Repos',
    component: () => import('@/views/repos/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repos/create',
    name: 'CreateRepo',
    component: () => import('@/views/repos/create.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repos/:id',
    name: 'RepoDetail',
    component: () => import('@/views/repos/detail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/branches',
    name: 'Branches',
    component: () => import('@/views/branches/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/branches/merge',
    name: 'MergeRequest',
    component: () => import('@/views/branches/merge.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/versions',
    name: 'Versions',
    component: () => import('@/views/versions/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/versions/baseline',
    name: 'Baseline',
    component: () => import('@/views/versions/baseline.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/versions/archive',
    name: 'Archive',
    component: () => import('@/views/versions/archive.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/approval/pending',
    name: 'ApprovalPending',
    component: () => import('@/views/approval/pending.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/approval/my-requests',
    name: 'MyRequests',
    component: () => import('@/views/approval/my-requests.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/approval/history',
    name: 'ApprovalHistory',
    component: () => import('@/views/approval/history.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/audit/logs',
    name: 'AuditLogs',
    component: () => import('@/views/audit/logs.vue'),
    meta: { requiresAuth: true, permission: 'audit:view' }
  },
  {
    path: '/audit/reports',
    name: 'AuditReports',
    component: () => import('@/views/audit/reports.vue'),
    meta: { requiresAuth: true, permission: 'audit:view' }
  },
  {
    path: '/audit/warning',
    name: 'RiskWarning',
    component: () => import('@/views/audit/warning.vue'),
    meta: { requiresAuth: true, permission: 'audit:view' }
  },
  {
    path: '/admin/users',
    name: 'UserManagement',
    component: () => import('@/views/admin/users.vue'),
    meta: { requiresAuth: true, permission: 'admin:manage' }
  },
  {
    path: '/admin/roles',
    name: 'RoleManagement',
    component: () => import('@/views/admin/roles.vue'),
    meta: { requiresAuth: true, permission: 'admin:manage' }
  },
  {
    path: '/admin/depts',
    name: 'DeptManagement',
    component: () => import('@/views/admin/depts.vue'),
    meta: { requiresAuth: true, permission: 'admin:manage' }
  },
  {
    path: '/admin/backup',
    name: 'BackupManagement',
    component: () => import('@/views/admin/backup.vue'),
    meta: { requiresAuth: true, permission: 'admin:manage' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/profile/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/settings/index.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth !== false && !userStore.isAuthenticated) {
    if (to.path !== '/login') {
      next('/login')
      return
    }
  }

  if (to.meta.permission && !userStore.hasPermission(to.meta.permission)) {
    ElMessage.error('您没有权限访问该页面')
    next('/dashboard')
    return
  }

  next()
})

export default router
