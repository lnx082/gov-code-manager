/**
 * 根组件（布局框架/侧边栏/顶部导航/路由视图）
 */
<template>
  <div class="app-container" v-if="userStore.isAuthenticated">
    <!-- 顶部导航栏 - 政务风格 -->
    <header class="gov-header">
      <div class="header-left">
        <el-icon :size="28" class="header-emblem"><Platform /></el-icon>
        <div class="header-title">
          <h1>党政软件版本管控平台</h1>
        </div>
      </div>
      <div class="header-right">
        <el-badge :value="noticeCount" :hidden="noticeCount === 0" class="notice-badge">
          <el-button class="header-btn" @click="showNoticeDialog = true; loadNotices()">
            <el-icon class="btn-icon"><Bell /></el-icon>
            <span class="btn-text">通知</span>
          </el-button>
        </el-badge>
        <el-dropdown @command="handleUserCommand">
          <div class="user-info">
            <div class="user-avatar">
              <span>{{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}</span>
            </div>
            <div class="user-details">
              <span class="username">{{ userStore.username }}</span>
              <span class="user-role">{{ userStore.roleName }}</span>
            </div>
            <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile"><el-icon><User /></el-icon> 个人中心</el-dropdown-item>
              <el-dropdown-item command="settings"><el-icon><Setting /></el-icon> 系统设置</el-dropdown-item>
              <el-dropdown-item divided command="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 主体区域 -->
    <div class="app-body">
      <!-- 侧边栏 -->
      <aside class="gov-sidebar" :style="{ width: sidebarCollapsed ? '64px' : '220px' }">
        <el-menu
          :default-active="$route.path"
          :collapse="sidebarCollapsed"
          router
          class="sidebar-menu"
          background-color="#ffffff"
          text-color="#303133"
          active-text-color="#ffffff"
        >
          <el-menu-item index="/dashboard">
            <el-icon class="menu-icon"><HomeFilled /></el-icon>
            <template #title>工作台</template>
          </el-menu-item>

          <!-- v-show 保持 DOM 结构稳定，只切换显隐，角色未加载时 userStore.userInfo 为 null 全部隐藏 -->
          <el-sub-menu index="repositories" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Folder /></el-icon>
              <span>仓库管理</span>
            </template>
            <el-menu-item index="/repos">仓库列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="branches" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Share /></el-icon>
              <span>分支管理</span>
            </template>
            <el-menu-item index="/branches">分支列表</el-menu-item>
            <el-menu-item index="/branches/merge">合并请求</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="versions" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Collection /></el-icon>
              <span>版本管理</span>
            </template>
            <el-menu-item index="/versions">版本列表</el-menu-item>
            <el-menu-item index="/versions/baseline">基线管理</el-menu-item>
            <el-menu-item index="/versions/archive">归档管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="approval" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><DocumentChecked /></el-icon>
              <span>审批管理</span>
            </template>
            <el-menu-item index="/approval/pending" v-show="userStore.role === 'admin' || userStore.role === 'project_manager'">待我审批</el-menu-item>
            <el-menu-item index="/approval/my-requests">我的申请</el-menu-item>
            <el-menu-item index="/approval/history">审批历史</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="audit">
            <template #title>
              <el-icon class="menu-icon"><Search /></el-icon>
              <span>审计管理</span>
            </template>
            <el-menu-item index="/audit/logs">操作日志</el-menu-item>
            <el-menu-item index="/audit/reports">审计报表</el-menu-item>
            <el-menu-item index="/audit/warning">风险预警</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="admin" v-show="userStore.userInfo && userStore.hasPermission('admin:manage')">
            <template #title>
              <el-icon class="menu-icon"><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/admin/users">用户管理</el-menu-item>
            <el-menu-item index="/admin/roles">角色权限</el-menu-item>
            <el-menu-item index="/admin/depts">部门管理</el-menu-item>
            <el-menu-item index="/admin/backup">备份管理</el-menu-item>
          </el-sub-menu>
        </el-menu>

      </aside>

      <!-- 侧边栏折叠按钮（固定屏幕左下角） -->
      <div class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed" :style="{ left: sidebarCollapsed ? '64px' : '220px' }">
        <el-icon><DArrowRight v-if="sidebarCollapsed" /><DArrowLeft v-else /></el-icon>
      </div>

      <!-- 主内容区 -->
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 底部版权 -->
    <footer class="gov-footer">
      <p>党政软件版本管控平台 © 2026 版权所有 | 技术支持：电科院52组</p>
    </footer>

    <!-- 通知弹窗 -->
    <el-dialog v-model="showNoticeDialog" title="系统通知" width="600px">
      <div class="notice-list">
        <el-empty v-if="notices.length === 0" description="暂无通知" />
        <div v-else v-for="notice in notices" :key="notice.id" class="notice-item">
          <div class="notice-header">
            <div class="notice-title">{{ notice.title }}</div>
            <el-tag v-if="notice.isSys" size="small" type="info">系统通知</el-tag>
            <el-tag v-else size="small" type="warning">审批通知</el-tag>
          </div>
          <div class="notice-content">{{ notice.content }}</div>
          <div class="notice-footer">
            <span class="notice-time">{{ notice.createTime }}</span>
            <el-button type="primary" link size="small" @click="viewNoticeDetail(notice)">查看详情</el-button>
            <el-button v-if="notice.isSys && !notice.read" type="primary" link size="small" @click="handleSysNotice(notice)">标记已读</el-button>
            <el-button v-else-if="notice.isSys && notice.read" type="success" link size="small" disabled>已读</el-button>
            <el-button v-else type="warning" link size="small" @click="handleApprovalNotice(notice)">去审批</el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 通知详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="通知详情" width="500px">
      <div v-if="detailNotice" class="notice-detail">
        <div class="detail-header">
          <h3>{{ detailNotice.title }}</h3>
          <el-tag v-if="detailNotice.isSys" size="small" type="info">系统通知</el-tag>
          <el-tag v-else size="small" type="warning">审批通知</el-tag>
        </div>
        <el-divider />
        <div class="detail-body">{{ detailNotice.content }}</div>
        <el-divider />
        <div class="detail-time">发布时间：{{ detailNotice.createTime }}</div>
      </div>
    </el-dialog>
  </div>

  <!-- 未登录显示登录页 -->
  <router-view v-else />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, User, Setting, SwitchButton, HomeFilled, Folder, Share, Collection, DocumentChecked, Search, DArrowRight, DArrowLeft, ArrowDown, Platform } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import request from '@/api'
import { markNotificationRead } from '@/api/bff'


const router = useRouter()
const userStore = useUserStore()

const sidebarCollapsed = ref(false)
const showNoticeDialog = ref(false)
const showDetailDialog = ref(false)
const noticeCount = ref(0)
const notices = ref([])
const detailNotice = ref(null)
let noticeTimer = null

onMounted(async () => {
  await userStore.initUser()
  loadNoticeCount()
  // 每 15 秒轮询一次通知数
  noticeTimer = setInterval(loadNoticeCount, 15000)
})

onUnmounted(() => {
  if (noticeTimer) clearInterval(noticeTimer)
})

async function loadNoticeCount() {
  try {
    const res = await request.get('/notifications/count')
    noticeCount.value = (res.data || res)?.count || 0
  } catch (_) { noticeCount.value = 0 }
}

async function loadNotices() {
  const all = []
  // 加载全部通知（含已读，便于展示历史）
  try {
    const sysRes = await request.get('/notifications', { params: { page: 1, pageSize: 50 } })
    const sysList = (sysRes.data || sysRes)?.list || []
    for (const item of sysList) {
      all.push({
        id: 'sys_' + item.notification_id,
        title: item.title || '系统通知',
        content: item.content || '',
        createTime: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '',
        isSys: true,
        notiId: item.notification_id,
        read: item.is_read === true || item.is_read === 'true'
      })
    }
  } catch (_) { /* ignore */ }
  // 审批通知
  try {
    const pendRes = await request.get('/approvals/pending', { params: { page: 1, pageSize: 10 } })
    const pendList = (pendRes.data || pendRes)?.list || []
    const stepNames = ['', '待项目管理员审批', '待系统管理员审批']
    const typeMap = { version_release: '版本发布', baseline_create: '基线申请', baseline_change: '基线变更', baseline_freeze: '基线冻结', baseline_archive: '基线归档', merge: '合并请求' }
    for (const item of pendList) {
      all.push({
        id: 'pend_' + item.approval_id,
        title: item.title,
        content: (typeMap[item.operation_type] || item.operation_type) + ' | ' + stepNames[item.current_step] + ' | 申请人: ' + item.applicant_username,
        createTime: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '',
        isSys: false
      })
    }
  } catch (_) { /* ignore */ }
  notices.value = all
}

function handleUserCommand(command) {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await userStore.logout()
        router.push('/login')
        ElMessage.success('已安全退出')
      }).catch(() => {})
      break
  }
}

function viewNoticeDetail(notice) {
  detailNotice.value = notice
  showDetailDialog.value = true
  // 系统通知查看详情后自动标记已读
  if (notice.isSys && !notice.read && notice.notiId) {
    markNotificationRead(notice.notiId).then(() => {
      notice.read = true
      loadNoticeCount()
    }).catch(_ => {})
  }
}

async function handleSysNotice(notice) {
  if (notice.notiId) {
    try {
      await markNotificationRead(notice.notiId)
      ElMessage.success('已标记为已读')
    } catch {
      ElMessage.warning('操作失败')
    }
  }
  notice.read = true
  loadNoticeCount()
}

function handleApprovalNotice() {
  showNoticeDialog.value = false
  router.push('/approval/pending')
}
</script>

<style lang="scss" scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

/* 顶部导航 */
.gov-header {
  height: 64px;
  background: linear-gradient(90deg, #c41230 0%, #8b0000 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 100;

  .header-left {
    display: flex;
    align-items: center;
    gap: 15px;

    .header-emblem {
      width: 44px;
      height: 44px;
    }

    .header-title {
      h1 {
        font-size: 20px;
        font-weight: 600;
        color: #fff;
        letter-spacing: 1px;
      }

      .header-subtitle {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 15px;

    .header-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #fff;
      padding: 8px 15px;

      .btn-icon {
        margin-right: 5px;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 5px 15px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      transition: background 0.3s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .user-avatar {
        width: 36px;
        height: 36px;
        background: #ffd700;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #8b0000;
      }

      .user-details {
        display: flex;
        flex-direction: column;

        .username {
          color: #fff;
          font-size: 14px;
          font-weight: 500;
        }

        .user-role {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }
      }

      .dropdown-arrow {
        color: rgba(255, 255, 255, 0.7);
        font-size: 10px;
      }
    }
  }
}

/* 主体区域 */
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 侧边栏 */
.gov-sidebar {
  background: #ffffff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
  border-right: 1px solid #e4e7ed;
  position: sticky;
  top: 0;
  height: 100vh;

  .sidebar-menu {
    flex: 1;
    border-right: none;
    overflow-y: auto;
    overflow-x: hidden;

    &:not(.el-menu--collapse) {
      width: 100%;
    }

    .menu-icon {
      margin-right: 10px;
      font-size: 16px;
      width: 20px;
      text-align: center;
    }

    :deep(.el-sub-menu__title) {
      color: #303133;
      &:hover {
        background: #ffebee !important;
        color: #c62828 !important;
      }
    }

    :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
      color: #c62828 !important;
    }

    :deep(.el-menu-item) {
      color: #303133;
      &:hover {
        background: #ffebee !important;
        color: #c62828 !important;
      }

      &.is-active {
        background: #c62828 !important;
        color: #ffffff !important;
      }
    }
  }

.sidebar-toggle {
  position: fixed;
  bottom: 0;
  z-index: 101;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 0 6px 0 0;
  transition: left 0.3s ease;
  font-size: 14px;

  &:hover {
    background: #ffebee;
    color: #c62828;
  }
}
}

/* 主内容区 */
.app-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f5f5f5;
}

/* 底部版权 */
.gov-footer {
  background: #fff;
  color: #666;
  padding: 16px 20px;
  text-align: center;
  font-size: 13px;
  border-top: 1px solid #e4e7ed;
}

.notice-badge {
  :deep(.el-badge__content) {
    background: #ffd700;
    color: #333;
  }
}

.notice-list {
  .notice-item {
    padding: 15px;
    border-bottom: 1px solid #eee;

    .notice-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;

      .notice-title {
        font-weight: 600;
        color: #333;
      }
    }

    .notice-content {
      color: #666;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .notice-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .notice-time {
        color: #999;
        font-size: 12px;
      }
    }
  }
}

.notice-detail {
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    h3 { margin: 0; font-size: 16px; color: #333; }
  }
  .detail-body {
    font-size: 14px;
    color: #555;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  .detail-time {
    font-size: 12px;
    color: #999;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
