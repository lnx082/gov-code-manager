<template>
  <div class="app-container" v-if="userStore.isAuthenticated">
    <!-- 顶部导航栏 - 政务风格 -->
    <header class="gov-header">
      <div class="header-left">
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23c41230'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(0 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(45 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(90 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(135 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(180 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(225 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(270 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23ffd700' transform='rotate(315 50 50)'/%3E%3Ccircle cx='50' cy='50' r='20' fill='%23c41230'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='18' fill='%23ffd700' font-weight='bold'%3E%E5%85%9A%3C/text%3E%3C/svg%3E" alt="党徽" class="header-emblem" />
        <div class="header-title">
          <h1>党政软件版本管控平台</h1>
          <span class="header-subtitle">GovCode Version Control Platform</span>
        </div>
      </div>
      <div class="header-right">
        <el-badge :value="noticeCount" :hidden="noticeCount === 0" class="notice-badge">
          <el-button class="header-btn" @click="showNoticeDialog = true">
            <span class="btn-icon">🔔</span>
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
              <span class="user-role">{{ userStore.role }}</span>
            </div>
            <span class="dropdown-arrow">▼</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">👤 个人中心</el-dropdown-item>
              <el-dropdown-item command="settings">⚙️ 系统设置</el-dropdown-item>
              <el-dropdown-item divided command="logout">🚪 退出登录</el-dropdown-item>
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
          background-color="#8b0000"
          text-color="#fff"
          active-text-color="#ffd700"
        >
          <el-menu-item index="/dashboard">
            <span class="menu-icon">🏠</span>
            <template #title>工作台</template>
          </el-menu-item>

          <el-sub-menu index="repositories">
            <template #title>
              <span class="menu-icon">📁</span>
              <span>仓库管理</span>
            </template>
            <el-menu-item index="/repos">仓库列表</el-menu-item>
            <el-menu-item index="/repos/create">创建仓库</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="branches">
            <template #title>
              <span class="menu-icon">🌿</span>
              <span>分支管理</span>
            </template>
            <el-menu-item index="/branches">分支列表</el-menu-item>
            <el-menu-item index="/branches/merge">合并请求</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="versions">
            <template #title>
              <span class="menu-icon">🏷️</span>
              <span>版本管理</span>
            </template>
            <el-menu-item index="/versions">版本列表</el-menu-item>
            <el-menu-item index="/versions/baseline">基线管理</el-menu-item>
            <el-menu-item index="/versions/archive">归档管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="approval">
            <template #title>
              <span class="menu-icon">📋</span>
              <span>审批管理</span>
            </template>
            <el-menu-item index="/approval/pending">待我审批</el-menu-item>
            <el-menu-item index="/approval/my-requests">我的申请</el-menu-item>
            <el-menu-item index="/approval/history">审批历史</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="audit" v-if="userStore.hasPermission('audit:view')">
            <template #title>
              <span class="menu-icon">🔍</span>
              <span>审计管理</span>
            </template>
            <el-menu-item index="/audit/logs">操作日志</el-menu-item>
            <el-menu-item index="/audit/reports">审计报表</el-menu-item>
            <el-menu-item index="/audit/warning">风险预警</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="admin" v-if="userStore.hasPermission('admin:manage')">
            <template #title>
              <span class="menu-icon">⚙️</span>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/admin/users">用户管理</el-menu-item>
            <el-menu-item index="/admin/roles">角色权限</el-menu-item>
            <el-menu-item index="/admin/depts">部门管理</el-menu-item>
            <el-menu-item index="/admin/backup">备份管理</el-menu-item>
          </el-sub-menu>
        </el-menu>

        <div class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed">
          {{ sidebarCollapsed ? '▶' : '◀' }}
        </div>
      </aside>

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
      <p>党政软件版本管控平台 © 2024 版权所有 | 技术支持：信息化建设办公室</p>
    </footer>

    <!-- 通知弹窗 -->
    <el-dialog v-model="showNoticeDialog" title="系统通知" width="600px">
      <div class="notice-list">
        <el-empty v-if="notices.length === 0" description="暂无通知" />
        <div v-else v-for="notice in notices" :key="notice.id" class="notice-item">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const sidebarCollapsed = ref(false)
const showNoticeDialog = ref(false)
const noticeCount = ref(0)
const notices = ref([])

onMounted(() => {
  userStore.initUser()
  loadNotices()
})

function loadNotices() {
  notices.value = []
  noticeCount.value = notices.value.length
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
      }).then(() => {
        userStore.logout()
        router.push('/login')
        ElMessage.success('已安全退出')
      }).catch(() => {})
      break
  }
}
</script>

<style lang="scss" scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
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
  background: linear-gradient(180deg, #8b0000 0%, #6b0000 100%);
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;

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
    }

    :deep(.el-sub-menu__title) {
      &:hover {
        background: rgba(255, 255, 255, 0.1) !important;
      }
    }

    :deep(.el-menu-item) {
      &:hover {
        background: rgba(255, 255, 255, 0.1) !important;
      }
    }
  }

  .sidebar-toggle {
    padding: 15px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    background: rgba(0, 0, 0, 0.2);
    transition: all 0.3s;
    flex-shrink: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
  }
}

/* 主内容区 */
.app-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f5f7fa;
}

/* 底部版权 */
.gov-footer {
  background: #333;
  color: #fff;
  padding: 12px 20px;
  text-align: center;
  font-size: 13px;
  opacity: 0.9;
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
