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

          <el-sub-menu index="repositories">
            <template #title>
              <el-icon class="menu-icon"><Folder /></el-icon>
              <span>仓库管理</span>
            </template>
            <el-menu-item index="/repos">仓库列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="branches">
            <template #title>
              <el-icon class="menu-icon"><Share /></el-icon>
              <span>分支管理</span>
            </template>
            <el-menu-item index="/branches">分支列表</el-menu-item>
            <el-menu-item index="/branches/merge">合并请求</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="versions">
            <template #title>
              <el-icon class="menu-icon"><Collection /></el-icon>
              <span>版本管理</span>
            </template>
            <el-menu-item index="/versions">版本列表</el-menu-item>
            <el-menu-item index="/versions/baseline">基线管理</el-menu-item>
            <el-menu-item index="/versions/archive">归档管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="approval">
            <template #title>
              <el-icon class="menu-icon"><DocumentChecked /></el-icon>
              <span>审批管理</span>
            </template>
            <el-menu-item index="/approval/pending" v-if="userStore.role === 'admin' || userStore.role === 'project_manager'">待我审批</el-menu-item>
            <el-menu-item index="/approval/my-requests">我的申请</el-menu-item>
            <el-menu-item index="/approval/history">审批历史</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="audit" v-if="userStore.role === 'admin' || userStore.role === 'auditor'">
            <template #title>
              <el-icon class="menu-icon"><Search /></el-icon>
              <span>审计管理</span>
            </template>
            <el-menu-item index="/audit/logs">操作日志</el-menu-item>
            <el-menu-item index="/audit/reports">审计报表</el-menu-item>
            <el-menu-item index="/audit/warning">风险预警</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="admin" v-if="userStore.hasPermission('admin:manage')">
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
        <div v-else v-for="notice in notices" :key="notice.id" class="notice-item" style="cursor:pointer" @click="showNoticeDialog = false; router.push('/approval/pending')">
          <div class="notice-title">{{ notice.title }}</div>
          <div class="notice-content">{{ notice.content }}</div>
          <div class="notice-time">{{ notice.createTime }}</div>
        </div>
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

const router = useRouter()
const userStore = useUserStore()

const sidebarCollapsed = ref(false)
const showNoticeDialog = ref(false)
const noticeCount = ref(0)
const notices = ref([])
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
  } catch { noticeCount.value = 0 }
}

async function loadNotices() {
  try {
    const res = await request.get('/approvals/pending', { params: { page: 1, pageSize: 10 } })
    const list = (res.data || res)?.list || []
    // 映射步骤号为人读名称
    notices.value = list.map(item => {
      const stepNames = ['', '待项目管理员审批', '待系统管理员审批']
      const stepText = stepNames[item.current_step] || `步骤 ${item.current_step}`
      const typeMap = { version_release: '版本发布', baseline_create: '基线申请', merge: '合并请求' }
      return {
        id: item.approval_id,
        title: item.title,
        content: `${typeMap[item.operation_type] || item.operation_type} | ${stepText} | 申请人: ${item.applicant_username}`,
        createTime: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''
      }
    })
  } catch { notices.value = [] }
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

    .notice-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 5px;
    }

    .notice-content {
      color: #666;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .notice-time {
      color: #999;
      font-size: 12px;
    }
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
