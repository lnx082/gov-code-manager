<template>
  <div class="dashboard-container">
    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <div class="banner-content">
        <div class="banner-left">
          <div class="welcome-text">
            <h2>为人民服务</h2>
            <p>{{ currentDate.date }}</p>
            <p class="lunar-date">{{ currentDate.lunar }}</p>
          </div>
        </div>
        <div class="banner-right">
          <el-button type="primary" size="large" @click="$router.push('/repos/create')">
            <el-icon><Plus /></el-icon> 创建仓库
          </el-button>
          <el-button size="large" @click="$router.push('/approval/pending')">
            <el-icon><DocumentChecked /></el-icon> 待我审批
            <el-badge :value="pendingApprovals" :hidden="pendingApprovals === 0" />
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card red clickable" @click="$router.push('/repos')">
        <div class="stat-icon"><el-icon><Folder /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.repoCount }}</div>
          <div class="stat-label">仓库总数</div>
        </div>
      </div>

      <div class="stat-card blue clickable" @click="$router.push('/versions')">
        <div class="stat-icon"><el-icon><Collection /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.versionCount }}</div>
          <div class="stat-label">版本总数</div>
        </div>
      </div>

      <div class="stat-card orange clickable" @click="$router.push('/approval/pending')" v-if="isAdmin || userStore.role === 'project_manager'">
        <div class="stat-icon"><el-icon><DocumentChecked /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pendingApprovals }}</div>
          <div class="stat-label">待审批</div>
        </div>
      </div>

      <div class="stat-card green" :class="{ clickable: isAdmin }" @click="isAdmin && showOnlineUsers()" v-if="isAdmin">
        <div class="stat-icon"><el-icon><User /></el-icon></div>
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
        <!-- 待处理事项（仅管理员/项目管理员可见） -->
        <el-card class="panel-card" shadow="hover" v-if="isAdmin || userStore.role === 'project_manager'">
          <template #header>
            <div class="card-header">
              <span><el-icon><DocumentChecked /></el-icon> 待处理审批</span>
              <el-link type="danger" @click="$router.push('/approval/pending')">查看全部</el-link>
            </div>
          </template>
          <div class="pending-list" v-if="pendingList.length > 0">
            <div v-for="item in pendingList" :key="item.id" class="pending-item" @click="$router.push('/approval/pending')">
              <div class="item-icon" :class="item.type">
                <el-icon v-if="item.type === 'merge'"><Share /></el-icon><el-icon v-else-if="item.type === 'version'"><Collection /></el-icon><el-icon v-else><Document /></el-icon>
              </div>
              <div class="item-content">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-info">
                  <span><el-icon><User /></el-icon> {{ item.applicant }}</span>
                  <span><el-icon><Clock /></el-icon> {{ item.createTime }}</span>
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
            <span><el-icon><Notebook /></el-icon> 最新动态</span>
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
                <div class="activity-time"><el-icon><Clock /></el-icon> {{ activity.time }}</div>
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
            <span><el-icon><Lightning /></el-icon> 快捷入口</span>
          </template>
          <div class="quick-links">
            <div class="quick-link-item" @click="$router.push('/repos')">
              <div class="link-icon blue"><el-icon><Folder /></el-icon></div>
              <span>仓库管理</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/branches/merge')">
              <div class="link-icon green"><el-icon><Share /></el-icon></div>
              <span>合并请求</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/versions')">
              <div class="link-icon orange"><el-icon><Collection /></el-icon></div>
              <span>版本管理</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/audit/logs')" v-if="isAdmin || userStore.role === 'auditor'">
              <div class="link-icon red"><el-icon><Search /></el-icon></div>
              <span>审计日志</span>
            </div>
          </div>
        </el-card>

        <!-- 系统状态 -->
        <el-card class="panel-card" shadow="hover">
          <template #header>
            <span><el-icon><Monitor /></el-icon> 系统状态</span>
          </template>
          <div class="system-status">
            <div class="status-item">
              <span class="status-label">总仓库数</span>
              <span class="status-value">{{ stats.repoCount }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">总版本数</span>
              <span class="status-value">{{ stats.versionCount }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">总用户数</span>
              <span class="status-value">{{ stats.userCount || '-' }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">在线用户</span>
              <span class="status-value">{{ stats.onlineUsers }}</span>
            </div>
          </div>
        </el-card>
      </div>
    </div>
    <!-- 在线用户弹窗 -->
    <el-dialog v-model="showOnlineDialog" title="在线用户" width="700px" :close-on-click-modal="false">
      <el-table :data="onlineUserList" v-loading="loadingOnline" stripe border max-height="400">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="department_name" label="部门" width="120">
          <template #default="{ row }">{{ row.department_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="登录时间" width="160">
          <template #default="{ row }">{{ formatTime(row.login_time) }}</template>
        </el-table-column>
        <el-table-column label="最后活跃" width="160">
          <template #default="{ row }">{{ formatTime(row.last_active) }}</template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP 地址" width="130" />
      </el-table>
      <template #footer>
        <span class="online-footer">当前在线 <strong>{{ onlineUserList.length }}</strong> 人</span>
        <el-button @click="showOnlineDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, DocumentChecked, Folder, Collection, User, Clock, Share, Document, Notebook, Lightning, Monitor, Search } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getDashboardStats } from '@/api/admin'
import { getPendingApprovals, getApprovalList } from '@/api/approval'
import { getSessions } from '@/api/bff'
import { Solar } from 'lunar-javascript'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.hasPermission('admin:manage') || userStore.role === 'admin')

const currentDate = computed(() => {
  const now = new Date()
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
  // 农历日期
  let lunarStr = ''
  try {
    const solar = Solar.fromDate(now)
    const lunar = solar.getLunar()
    const monthCn = lunar.getMonthInChinese()
    const dayCn = lunar.getDayInChinese()
    lunarStr = `农历${lunar.getYearInChinese()}年${monthCn}月${dayCn}（${lunar.getYearShengXiao()}年）`
  } catch {
    lunarStr = ''
  }
  return { date: dateStr, lunar: lunarStr }
})

// 在线用户弹窗
const showOnlineDialog = ref(false)
const onlineUserList = ref([])
const loadingOnline = ref(false)

async function showOnlineUsers() {
  showOnlineDialog.value = true
  loadingOnline.value = true
  try {
    const res = await getSessions({ page: 1, pageSize: 200 })
    const data = res.data || res
    onlineUserList.value = data.list || data || []
  } catch (error) {
    ElMessage.error('获取在线用户列表失败')
    onlineUserList.value = []
  } finally {
    loadingOnline.value = false
  }
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const stats = reactive({
  repoCount: 0,
  versionCount: 0,
  pendingApprovals: 0,
  onlineUsers: 0,
  userCount: 0
})

const pendingApprovals = computed(() => stats.pendingApprovals)

const pendingList = ref([])
const recentActivities = ref([])

onMounted(() => {
  loadDashboardData()
  loadPendingApprovals()
  loadRecentActivities()
})

async function loadDashboardData() {
  try {
    // 所有统计从 BFF 获取（含真实仓库 + 版本数）
    const res = await getDashboardStats()
    const data = res.data || res
    if (data) {
      stats.repoCount = data.repoCount || 0
      stats.versionCount = data.versionCount || 0
      stats.pendingApprovals = data.pendingApprovals || 0
      stats.onlineUsers = data.onlineUsers || 0
      stats.userCount = data.userCount || 0
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

async function loadRecentActivities() {
  try {
    // 从审批记录获取真实最新动态
    const res = await getApprovalList({ page: 1, pageSize: 5 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    recentActivities.value = (Array.isArray(list) ? list : []).map(item => {
      const statusText = item.status === 'approved' ? '审批通过' : item.status === 'rejected' ? '审批拒绝' : '提交了审批'
      const typeText = item.operation_type === 'version_release' ? '版本发布' : item.operation_type === 'baseline_create' ? '基线申请' : '合并请求'
      return {
        id: item.approval_id,
        user: item.applicant_username || '未知',
        action: `${statusText} ${typeText}`,
        target: item.title || '',
        time: item.created_at || item.updated_at || ''
      }
    })
  } catch (error) {
    recentActivities.value = []
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
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;

      .welcome-text {
        text-align: center;
        h2 {
          font-size: 52px;
          margin-bottom: 20px;
          font-family: 'MaoTi', 'STLiti', 'FZXiaoZhuanTi', cursive;
          font-weight: normal;
          background: linear-gradient(180deg, #ffd700 0%, #ff8c00 50%, #ffd700 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: none;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          letter-spacing: 8px;
        }
        p {
          opacity: 0.9;
          font-size: 14px;
          margin: 2px 0;
        }
        .lunar-date {
          font-size: 12px;
          opacity: 0.7;
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

    &.clickable {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(103, 194, 58, 0.4);
      }
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

.online-footer {
  float: left;
  font-size: 14px;
  color: #666;
  line-height: 32px;
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
