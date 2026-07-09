<template>
  <div class="dashboard-container">
    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <div class="banner-content">
        <div class="banner-left">
          <div class="emblem-area">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23ffd700'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(45 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(90 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(135 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(180 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(225 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(270 50 50)'/%3E%3Cpath d='M50 10 L53 40 L50 45 L47 40 Z' fill='%23c41230' transform='rotate(315 50 50)'/%3E%3Ccircle cx='50' cy='50' r='20' fill='%23ffd700'/%3E%3C/svg%3E" alt="党徽" class="banner-emblem" />
          </div>
          <div class="welcome-text">
            <h2>欢迎回来，{{ userStore.username }}</h2>
            <p>今天是 {{ currentDate }}，祝您工作顺利</p>
          </div>
        </div>
        <div class="banner-right">
          <el-button type="primary" size="large" @click="$router.push('/repos/create')">
            <span>➕</span> 创建仓库
          </el-button>
          <el-button size="large" @click="$router.push('/approval/pending')">
            <span>📋</span> 待我审批
            <el-badge :value="pendingApprovals" :hidden="pendingApprovals === 0" />
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card red">
        <div class="stat-icon">📁</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.repoCount }}</div>
          <div class="stat-label">仓库总数</div>
        </div>
      </div>
      
      <div class="stat-card blue">
        <div class="stat-icon">🏷️</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.versionCount }}</div>
          <div class="stat-label">版本总数</div>
        </div>
      </div>
      
      <div class="stat-card orange">
        <div class="stat-icon">📋</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pendingApprovals }}</div>
          <div class="stat-label">待审批</div>
        </div>
      </div>
      
      <div class="stat-card green">
        <div class="stat-icon">👥</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.onlineUsers }}</div>
          <div class="stat-label">在线用户</div>
        </div>
      </div>
    </div>

    <!-- 主内容 -->
    <div class="main-content">
      <!-- 左侧 -->
      <div class="content-left">
        <!-- 待处理事项 -->
        <el-card class="panel-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📋 待处理审批</span>
              <el-link type="danger" @click="$router.push('/approval/pending')">查看全部</el-link>
            </div>
          </template>
          <div class="pending-list" v-if="pendingList.length > 0">
            <div v-for="item in pendingList" :key="item.id" class="pending-item" @click="$router.push('/approval/pending')">
              <div class="item-icon" :class="item.type">
                {{ item.type === 'merge' ? '🌿' : item.type === 'version' ? '🏷️' : '📄' }}
              </div>
              <div class="item-content">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-info">
                  <span>👤 {{ item.applicant }}</span>
                  <span>⏰ {{ item.createTime }}</span>
                </div>
              </div>
              <el-tag :type="getTypeTagType(item.type)" size="small">
                {{ getTypeName(item.type) }}
              </el-tag>
            </div>
          </div>
          <el-empty v-else description="暂无待处理事项" />
        </el-card>

        <!-- 最新动态 -->
        <el-card class="panel-card" shadow="hover">
          <template #header>
            <span>📰 最新动态</span>
          </template>
          <div class="activity-list">
            <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
              <div class="activity-avatar">{{ activity.user.charAt(0) }}</div>
              <div class="activity-content">
                <div class="activity-text">
                  <span class="user-name">{{ activity.user }}</span>
                  {{ activity.action }}
                  <span class="target-name">{{ activity.target }}</span>
                </div>
                <div class="activity-time">⏰ {{ activity.time }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧 -->
      <div class="content-right">
        <!-- 快捷入口 -->
        <el-card class="panel-card" shadow="hover">
          <template #header>
            <span>⚡ 快捷入口</span>
          </template>
          <div class="quick-links">
            <div class="quick-link-item" @click="$router.push('/repos')">
              <div class="link-icon blue">📁</div>
              <span>仓库管理</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/branches/merge')">
              <div class="link-icon green">🌿</div>
              <span>合并请求</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/versions')">
              <div class="link-icon orange">🏷️</div>
              <span>版本管理</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/audit/logs')">
              <div class="link-icon red">🔍</div>
              <span>审计日志</span>
            </div>
          </div>
        </el-card>

        <!-- 系统状态 -->
        <el-card class="panel-card" shadow="hover">
          <template #header>
            <span>💻 系统状态</span>
          </template>
          <div class="system-status">
            <div class="status-item">
              <span class="status-label">系统版本</span>
              <span class="status-value">v1.0.0</span>
            </div>
            <div class="status-item">
              <span class="status-label">Gitea服务</span>
              <span class="status-indicator online">
                <span class="dot"></span> 正常
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">数据库</span>
              <span class="status-indicator online">
                <span class="dot"></span> 正常
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">存储空间</span>
              <el-progress :percentage="storageUsed" :color="storageColor" :stroke-width="10" />
            </div>
          </div>
        </el-card>

        <!-- 风险预警 -->
        <el-card class="panel-card" shadow="hover" v-if="userStore.hasPermission('audit:view')">
          <template #header>
            <div class="card-header">
              <span>⚠️ 风险预警</span>
              <el-badge :value="riskCount" :hidden="riskCount === 0" />
            </div>
          </template>
          <div class="risk-list" v-if="risks.length > 0">
            <div v-for="risk in risks" :key="risk.id" class="risk-item">
              <span class="risk-icon">⚠️</span>
              <div class="risk-content">
                <div class="risk-title">{{ risk.title }}</div>
                <div class="risk-time">⏰ {{ risk.time }}</div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无风险预警" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getDashboardStats } from '@/api/admin'
import { getPendingApprovals } from '@/api/approval'
import { getRiskWarnings, getAuditLogs } from '@/api/bff'

const userStore = useUserStore()

const currentDate = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]}`
})

const stats = reactive({
  repoCount: 0,
  versionCount: 0,
  pendingApprovals: 0,
  onlineUsers: 0
})

const pendingApprovals = computed(() => stats.pendingApprovals)

const pendingList = ref([])
const recentActivities = ref([])
const storageUsed = ref(0)
const storageColor = computed(() => {
  if (storageUsed.value < 60) return '#67c23a'
  if (storageUsed.value < 80) return '#e6a23c'
  return '#f56c6c'
})

const riskCount = ref(0)
const risks = ref([])

onMounted(() => {
  loadDashboardData()
  loadPendingApprovals()
  loadRiskWarnings()
  loadRecentActivities()
})

async function loadDashboardData() {
  try {
    const res = await getDashboardStats()
    const data = res.data || res
    if (data) {
      stats.repoCount = data.repoCount || data.repos || 0
      stats.versionCount = data.versionCount || data.versions || 0
      stats.pendingApprovals = data.pendingApprovals || 0
      stats.onlineUsers = data.onlineUsers || data.users || 0
      storageUsed.value = data.storageUsed || data.storage || 0
    }
  } catch (error) {
    ElMessage.warning('加载统计数据失败')
  }
}

async function loadPendingApprovals() {
  try {
    const res = await getPendingApprovals({ page: 1, pageSize: 5 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    pendingList.value = (Array.isArray(list) ? list : []).map(item => ({
      id: item.id,
      type: item.operationType || item.type || 'merge',
      title: item.title || item.description || item.target,
      applicant: item.applicantName || item.applicant || item.username || '',
      createTime: item.createdAt || item.createTime || ''
    }))
    stats.pendingApprovals = pendingList.value.length
  } catch (error) {
    ElMessage.warning('加载待审批列表失败')
  }
}

async function loadRiskWarnings() {
  try {
    const res = await getRiskWarnings({ page: 1, pageSize: 5 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    risks.value = (Array.isArray(list) ? list : []).map(item => ({
      id: item.id,
      level: item.level || 'warning',
      title: item.title || item.description || '',
      time: item.createdAt || item.time || ''
    }))
    riskCount.value = risks.value.length
  } catch (error) {
    ElMessage.warning('加载风险预警失败')
  }
}

async function loadRecentActivities() {
  try {
    const res = await getAuditLogs({ page: 1, pageSize: 5 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    recentActivities.value = (Array.isArray(list) ? list : []).map(item => ({
      id: item.id,
      user: item.username || item.user || '',
      action: item.actionType || item.action || '',
      target: item.target || '',
      time: item.timestamp || item.createdAt || item.time || ''
    }))
  } catch (error) {
    ElMessage.warning('加载最新动态失败')
  }
}

function getTypeTagType(type) {
  const map = { merge: 'primary', version: 'success', baseline: 'warning' }
  return map[type] || 'info'
}

function getTypeName(type) {
  const map = { merge: '合并请求', version: '版本发布', baseline: '基线申请' }
  return map[type] || '其他'
}
</script>

<style lang="scss" scoped>
.dashboard-container {
  padding: 0;
}

/* 欢迎横幅 */
.welcome-banner {
  background: linear-gradient(135deg, #c41230 0%, #8b0000 100%);
  border-radius: 12px;
  padding: 30px;
  color: #fff;
  margin-bottom: 20px;
  box-shadow: 0 5px 20px rgba(196, 18, 48, 0.3);

  .banner-content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .banner-left {
      display: flex;
      align-items: center;
      gap: 20px;

      .emblem-area {
        .banner-emblem {
          width: 70px;
          height: 70px;
        }
      }

      .welcome-text {
        h2 {
          font-size: 24px;
          margin-bottom: 8px;
        }
        p {
          opacity: 0.9;
          font-size: 14px;
        }
      }
    }

    .banner-right {
      display: flex;
      gap: 15px;

      .el-button {
        padding: 12px 24px;
        font-size: 14px;
      }
    }
  }
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;

  .stat-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    border-radius: 12px;
    color: #fff;
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);

    .stat-icon {
      font-size: 48px;
      opacity: 0.9;
    }

    .stat-info {
      .stat-value {
        font-size: 32px;
        font-weight: 700;
      }
      .stat-label {
        font-size: 14px;
        opacity: 0.9;
      }
    }

    &.red {
      background: linear-gradient(135deg, #c41230 0%, #8b0000 100%);
    }
    &.blue {
      background: linear-gradient(135deg, #1e4d7b 0%, #0d3a5c 100%);
    }
    &.orange {
      background: linear-gradient(135deg, #e6a23c 0%, #c77c24 100%);
    }
    &.green {
      background: linear-gradient(135deg, #67c23a 0%, #4a9c2a 100%);
    }
  }
}

/* 主内容 */
.main-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
}

.content-left, .content-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-card {
  border-radius: 12px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }
}

/* 待处理列表 */
.pending-list {
  .pending-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    .item-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;

      &.merge { background: #ecf5ff; }
      &.version { background: #f0f9eb; }
      &.baseline { background: #fdf6ec; }
    }

    .item-content {
      flex: 1;

      .item-title {
        font-size: 14px;
        color: #333;
        margin-bottom: 4px;
      }

      .item-info {
        font-size: 12px;
        color: #999;

        span {
          margin-right: 10px;
        }
      }
    }
  }
}

/* 最新动态 */
.activity-list {
  .activity-item {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .activity-avatar {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #c41230 0%, #8b0000 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
    }

    .activity-content {
      flex: 1;

      .activity-text {
        font-size: 14px;
        color: #666;
        margin-bottom: 4px;

        .user-name, .target-name {
          color: #c41230;
          font-weight: 500;
        }
      }

      .activity-time {
        font-size: 12px;
        color: #999;
      }
    }
  }
}

/* 快捷入口 */
.quick-links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;

  .quick-link-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background: #f0f0f0;
      transform: translateY(-3px);
    }

    .link-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;

      &.blue { background: #e6f4ff; }
      &.green { background: #e6ffec; }
      &.orange { background: #fff7e6; }
      &.red { background: #fff0f0; }
    }

    span {
      font-size: 14px;
      color: #666;
    }
  }
}

/* 系统状态 */
.system-status {
  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .status-label {
      color: #666;
    }

    .status-value {
      color: #333;
      font-weight: 500;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #67c23a;

      .dot {
        width: 8px;
        height: 8px;
        background: #67c23a;
        border-radius: 50%;
        animation: pulse 2s infinite;
      }
    }
  }
}

/* 风险预警 */
.risk-list {
  .risk-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background: #fff8f8;

    .risk-icon {
      font-size: 20px;
    }

    .risk-content {
      flex: 1;

      .risk-title {
        font-size: 14px;
        color: #333;
        margin-bottom: 4px;
      }

      .risk-time {
        font-size: 12px;
        color: #999;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .main-content {
    grid-template-columns: 1fr;
  }
}
</style>
