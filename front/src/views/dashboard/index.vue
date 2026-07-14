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
          <el-button type="primary" size="large" @click="$router.push('/repos/create')" v-if="isAdmin || userStore.role === 'project_manager'">
            <el-icon><Plus /></el-icon> 创建仓库
          </el-button>
          <el-button size="large" @click="$router.push('/approval/pending')" v-if="isAdmin || userStore.role === 'project_manager'">
            <el-icon><DocumentChecked /></el-icon> 待我审批
            <el-badge :value="pendingApprovals" :hidden="pendingApprovals === 0" />
          </el-button>
          <el-button size="large" type="info" @click="$router.push('/audit/logs')" v-if="isAuditor">
            <el-icon><Search /></el-icon> 审计日志
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <!-- 非审计人员：显示业务统计 -->
      <template v-if="isAdmin || userStore.role === 'project_manager'">
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
      </template>

      <!-- 审计人员：只看审计相关统计 -->
      <template v-if="isAuditor">
      <div class="stat-card orange clickable" @click="$router.push('/audit/logs')">
        <div class="stat-icon"><el-icon><Search /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.auditLogCount || '-' }}</div>
          <div class="stat-label">审计日志</div>
        </div>
      </div>
      <div class="stat-card red clickable" @click="$router.push('/audit/warning')">
        <div class="stat-icon"><el-icon><WarningFilled /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.unhandledWarnings || 0 }}</div>
          <div class="stat-label">未处理预警</div>
        </div>
      </div>
      <div class="stat-card green" :class="{ clickable: isAdmin }" @click="isAdmin && showOnlineUsers()" v-if="isAdmin">
        <div class="stat-icon"><el-icon><User /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.onlineUsers }}</div>
          <div class="stat-label">在线用户</div>
        </div>
      </div>
      </template>
    </div>

    <!-- 趋势图（系统管理员可见） -->
    <el-card v-if="isAdmin" class="trends-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span><el-icon><DataAnalysis /></el-icon> 近 7 日趋势 </span>
          <span style="font-size:12px;color:#909399">操作量 · 版本发布 · 审批数</span>
        </div>
      </template>
      <div ref="trendChartRef" class="trend-chart"></div>
    </el-card>

    <!-- 主内容 -->
    <div class="main-content">
      <!-- 左侧 -->
      <div class="content-left">
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
        <!-- 快捷入口（审计人员不显示） -->
        <el-card class="panel-card" shadow="hover" v-if="isAdmin || userStore.role === 'project_manager'">
          <template #header>
            <span><el-icon><Lightning /></el-icon> 快捷入口</span>
          </template>
          <div class="quick-links">
            <!-- 非审计人员：业务快捷入口 -->
            <template v-if="!userStore.isAuditor">
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
            </template>
            <!-- 审计人员：审计快捷入口 -->
            <template v-if="userStore.isAuditor">
            <div class="quick-link-item" @click="$router.push('/audit/logs')">
              <div class="link-icon red"><el-icon><Search /></el-icon></div>
              <span>操作日志</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/audit/reports')">
              <div class="link-icon orange"><el-icon><DataAnalysis /></el-icon></div>
              <span>审计报表</span>
            </div>
            <div class="quick-link-item" @click="$router.push('/audit/warning')">
              <div class="link-icon red"><el-icon><WarningFilled /></el-icon></div>
              <span>风险预警</span>
            </div>
            </template>
            <!-- 管理员通用 -->
            <div class="quick-link-item" @click="$router.push('/audit/logs')" v-if="isAdmin && !userStore.isAuditor">
              <div class="link-icon red"><el-icon><Search /></el-icon></div>
              <span>审计日志</span>
            </div>
            <div class="quick-link-item" @click="openPublishDialog" v-if="isAdmin">
              <div class="link-icon red"><el-icon><Bell /></el-icon></div>
              <span>发布通知</span>
            </div>
          </div>
        </el-card>

        <!-- 系统状态 -->
        <el-card class="panel-card" shadow="hover">
          <template #header>
            <span><el-icon><Monitor /></el-icon> 系统状态</span>
          </template>
          <div class="system-status" v-if="sysInfo">
            <div class="status-item">
              <span class="status-label">Gitea 服务</span>
              <span class="status-indicator" :class="sysInfo.services?.gitea?.online ? 'online' : 'offline'">
                <span class="dot"></span> {{ sysInfo.services?.gitea?.online ? '正常' : '离线' }}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">数据库</span>
              <span class="status-indicator" :class="sysInfo.services?.database?.online ? 'online' : 'offline'">
                <span class="dot"></span> {{ sysInfo.services?.database?.online ? '正常' : '离线' }}
              </span>
            </div>
            <el-divider />
            <div class="status-item"><span class="status-label">BFF 主机</span><span class="status-value">{{ sysInfo.hostname }}</span></div>
            <div class="status-item"><span class="status-label">系统</span><span class="status-value">{{ sysInfo.platform }} {{ sysInfo.arch }}</span></div>
            <div class="status-item"><span class="status-label">CPU</span><span class="status-value">{{ sysInfo.cpu?.model?.substring(0, 30) }} ({{ sysInfo.cpu?.cores }}核)</span></div>
            <div class="status-item">
              <span class="status-label">CPU</span>
              <el-progress :percentage="sysInfo.cpu?.usage||0" :stroke-width="8" :color="sysInfo.cpu?.usage > 80 ? '#f56c6c' : '#67c23a'" />
            </div>
            <div class="status-item">
              <span class="status-label">内存</span>
              <el-progress :percentage="sysInfo.memory?.usagePct||0" :stroke-width="8" :color="sysInfo.memory?.usagePct > 80 ? '#f56c6c' : '#67c23a'" :format="() => formatBytes(sysInfo.memory?.used) + ' / ' + formatBytes(sysInfo.memory?.total)" />
            </div>
            <div class="status-item" v-if="sysInfo.disk?.total > 0">
              <span class="status-label">磁盘</span>
              <el-progress :percentage="sysInfo.disk?.usagePct||0" :stroke-width="8" :color="sysInfo.disk?.usagePct > 80 ? '#f56c6c' : '#67c23a'" :format="() => formatBytes(sysInfo.disk?.total - sysInfo.disk?.free) + ' / ' + formatBytes(sysInfo.disk?.total)" />
            </div>
            <div class="status-item"><span class="status-label">运行时间</span><span class="status-value">{{ formatUptime(sysInfo.uptime) }}</span></div>
          </div>
          <el-empty v-else description="无法获取系统信息" />
        </el-card>
      </div>
    </div>
    <!-- 发布通知弹窗 -->
    <el-dialog v-model="showPublishDialog" title="发布通知" width="500px" :close-on-click-modal="false" v-if="isAdmin">
      <el-form :model="publishForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="publishForm.title" placeholder="请输入通知标题" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="publishForm.content" type="textarea" :rows="5" placeholder="请输入通知内容" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPublishDialog = false">取消</el-button>
        <el-button type="primary" @click="handlePublish" :loading="publishing">发布</el-button>
      </template>
    </el-dialog>

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
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, DocumentChecked, Folder, Collection, User, Clock, Share, Document, Notebook, Lightning, Monitor, Search, Bell, WarningFilled, DataAnalysis } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getDashboardStats } from '@/api/admin'
import { getApprovalList } from '@/api/approval'
import { getSessions, publishNotification, getTrends } from '@/api/bff'
import request from '@/api'
import { Solar } from 'lunar-javascript'
import * as echarts from 'echarts'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.hasPermission('admin:manage') || userStore.role === 'admin')

// 三重兜底判断审计人员，绕过 computed 可能不正确的问题
const isAuditor = computed(() => {
  return userStore.isAuditor || userStore.roleName === '审计人员'
})

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

const recentActivities = ref([])
const sysInfo = ref(null)

// 趋势折线图
const trendChartRef = ref(null)
let trendChartInstance = null

async function initTrendChart() {
  if (!isAdmin.value) return
  await nextTick()
  if (!trendChartRef.value) return

  try {
    const res = await getTrends({ days: 7 })
    const data = res.data || res
    const trendData = Array.isArray(data) ? data : []

    if (!trendChartInstance) {
      trendChartInstance = echarts.init(trendChartRef.value)
    }

    const dates = trendData.map(d => d.date?.slice(5) || '') // MM-DD
    const commits = trendData.map(d => d.commits || 0)
    const versions = trendData.map(d => d.versions || 0)
    const approvals = trendData.map(d => d.approvals || 0)

    trendChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['操作量', '版本发布', '审批数'],
        bottom: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: '#dcdfe6' } },
        axisLabel: { color: '#909399' },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } },
        axisLabel: { color: '#909399' },
      },
      series: [
        {
          name: '操作量',
          type: 'line',
          smooth: true,
          data: commits,
          itemStyle: { color: '#409eff' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.25)' },
            { offset: 1, color: 'rgba(64,158,255,0.02)' },
          ])},
          lineStyle: { width: 2 },
        },
        {
          name: '版本发布',
          type: 'line',
          smooth: true,
          data: versions,
          itemStyle: { color: '#67c23a' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103,194,58,0.25)' },
            { offset: 1, color: 'rgba(103,194,58,0.02)' },
          ])},
          lineStyle: { width: 2 },
        },
        {
          name: '审批数',
          type: 'line',
          smooth: true,
          data: approvals,
          itemStyle: { color: '#e6a23c' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(230,162,60,0.25)' },
            { offset: 1, color: 'rgba(230,162,60,0.02)' },
          ])},
          lineStyle: { width: 2 },
        },
      ],
    })
  } catch {
    // trends fetch failed, chart remains empty
  }
}

// 窗口大小变化时自适应
function handleResize() {
  trendChartInstance?.resize?.()
}

// 发布通知
const showPublishDialog = ref(false)
const publishing = ref(false)
const publishForm = reactive({ title: '', content: '' })

function openPublishDialog() {
  publishForm.title = ''
  publishForm.content = ''
  showPublishDialog.value = true
}

async function handlePublish() {
  if (!publishForm.title || !publishForm.content) {
    ElMessage.warning('请填写完整标题和内容')
    return
  }
  publishing.value = true
  try {
    await publishNotification({ title: publishForm.title, content: publishForm.content })
    ElMessage.success('通知已发布')
    showPublishDialog.value = false
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '发布失败')
  } finally {
    publishing.value = false
  }
}

onMounted(() => {
  loadDashboardData()
  loadRecentActivities()
  loadSystemInfo()
  initTrendChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChartInstance?.dispose()
  trendChartInstance = null
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

async function loadRecentActivities() {
  try {
    // 从审批记录获取真实最新动态
    const res = await getApprovalList({ page: 1, pageSize: 5 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    recentActivities.value = (Array.isArray(list) ? list : []).map(item => {
      const statusText = item.status === 'approved' ? '审批通过' : item.status === 'rejected' ? '审批拒绝' : '提交了审批'
      const typeMap = { version_release: '版本发布', baseline_create: '基线申请', baseline_change: '基线变更', baseline_freeze: '基线冻结', baseline_archive: '基线归档' }
      const typeText = typeMap[item.operation_type] || '合并请求'
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

async function loadSystemInfo() {
  try {
    const res = await request.get('/statistics/system')
    sysInfo.value = (res.data || res)?.data || (res.data || res)
  } catch { sysInfo.value = null }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatUptime(seconds) {
  if (!seconds) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return (d > 0 ? d + '天 ' : '') + h + '小时 ' + m + '分钟'
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

/* 趋势图 */
.trends-card {
  margin-bottom: 20px;
  border-radius: 12px;

  .trend-chart {
    width: 100%;
    height: 340px;
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

      &.online { color: #67c23a; .dot { background: #67c23a; animation: pulse 2s infinite; } }
      &.offline { color: #f56c6c; .dot { background: #f56c6c; animation: none; } }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
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
