<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">审计报表</h2>
    </div>

    <el-row :gutter="20" class="report-stats">
      <el-col :span="6">
        <div class="stat-card clickable" @click="$router.push('/audit/logs')">
          <div class="stat-value">{{ stats.totalOperations }}</div>
          <div class="stat-label">总操作数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card clickable" @click="showActiveUsers">
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-label">活跃用户</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card clickable" @click="showRepoOperations">
          <div class="stat-value">{{ stats.totalRepos }}</div>
          <div class="stat-label">仓库操作</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card clickable" @click="showRiskWarnings">
          <div class="stat-value">{{ stats.riskCount }}</div>
          <div class="stat-label">风险预警</div>
        </div>
      </el-col>
    </el-row>

    <el-card class="report-card">
      <template #header>
        <div class="card-header">
          <span>生成报表</span>
        </div>
      </template>
      <el-form inline>
        <el-form-item label="报表类型">
          <el-select v-model="reportForm.type" style="width: 200px">
            <el-option label="版本变更统计" value="version" />
            <el-option label="操作审计报表" value="audit" />
            <el-option label="审批汇总报表" value="approval" />
            <el-option label="风险预警报表" value="risk" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="reportForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="导出格式">
          <el-select v-model="reportForm.format" style="width: 120px">
            <el-option label="PDF" value="pdf" />
            <el-option label="Excel" value="excel" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="generateReportHandler">
            <el-icon><Download /></el-icon>
            生成报表
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="report-card">
      <template #header>
        <div class="card-header">
          <span>最近报表</span>
        </div>
      </template>
      <el-table :data="reportList" stripe border>
        <el-table-column prop="name" label="报表名称" min-width="200" />
        <el-table-column prop="dateRange" label="时间范围" width="200" />
        <el-table-column label="生成时间" width="160">
          <template #default="{ row }">
            {{ row.createdAt || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="downloadReport(row)">下载</el-button>
            <el-button type="danger" link @click="deleteReport(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <!-- 仓库操作弹窗 -->
    <el-dialog v-model="showRepoDialog" title="仓库操作" width="650px">
      <el-table :data="repoOperationList" v-loading="loadingRepo" stripe border max-height="400">
        <el-table-column prop="username" label="操作用户" width="120" />
        <el-table-column label="操作类型" width="100">
          <template #default="{ row }">{{ getActionTypeName(row.actionType) }}</template>
        </el-table-column>
        <el-table-column prop="target" label="操作对象" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP 地址" width="140" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span style="float:left;color:#909399;font-size:14px;line-height:32px">共 {{ repoOperationList.length }} 条仓库操作</span>
        <el-button @click="showRepoDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 风险预警弹窗 -->
    <el-dialog v-model="showRiskDialog" title="风险预警" width="700px">
      <el-table :data="riskList" v-loading="loadingRisk" stripe border max-height="400">
        <el-table-column prop="title" label="预警标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="等级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.level === 'high' ? 'danger' : row.level === 'medium' ? 'warning' : 'info'" size="small">
              {{ row.level === 'high' ? '高危' : row.level === 'medium' ? '中危' : '低危' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="触发用户" width="100" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'handled' ? 'success' : 'danger'" size="small">{{ row.status === 'handled' ? '已处理' : '未处理' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span style="float:left;color:#909399;font-size:14px;line-height:32px">共 {{ riskList.length }} 条预警</span>
        <el-button @click="$router.push('/audit/warning')" type="primary" link>查看全部</el-button>
        <el-button @click="showRiskDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 活跃用户弹窗 -->
    <el-dialog v-model="showActiveDialog" title="活跃用户" width="550px">
      <el-table :data="activeUserList" v-loading="loadingActive" stripe border max-height="400">
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="ip" label="IP 地址" width="160" />
        <el-table-column prop="count" label="操作次数" width="100" align="center" />
      </el-table>
      <template #footer>
        <span style="float:left;color:#909399;font-size:14px;line-height:32px">共 {{ activeUserList.length }} 位活跃用户</span>
        <el-button @click="showActiveDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAuditReports, generateReport } from '@/api/audit'
import { getAuditStats } from '@/api/bff'

const stats = reactive({
  totalOperations: 0,
  totalUsers: 0,
  totalRepos: 0,
  riskCount: 0
})

const reportForm = reactive({
  type: 'version',
  dateRange: [],
  format: 'pdf'
})

const reportList = ref([])

// 风险预警弹窗
const showRiskDialog = ref(false)
const loadingRisk = ref(false)
const riskList = ref([])

async function showRiskWarnings() {
  showRiskDialog.value = true
  loadingRisk.value = true
  try {
    const { getRiskWarnings } = await import('@/api/bff')
    const res = await getRiskWarnings({ page: 1, pageSize: 100 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    riskList.value = (Array.isArray(list) ? list : []).map(r => ({
      title: r.title || r.description || '',
      level: r.level || 'low',
      username: r.related_username || '-',
      createdAt: r.created_at || r.createdAt || '',
      status: r.status || 'unhandled',
    }))
  } catch {
    riskList.value = []
    ElMessage.warning('获取风险预警失败')
  } finally {
    loadingRisk.value = false
  }
}

// 仓库操作弹窗
const showRepoDialog = ref(false)
const loadingRepo = ref(false)
const repoOperationList = ref([])

async function showRepoOperations() {
  showRepoDialog.value = true
  loadingRepo.value = true
  try {
    const { getAuditLogs } = await import('@/api/audit')
    // 后端直接按路径过滤，与统计口径一致
    const res = await getAuditLogs({ page: 1, pageSize: 500, target: '/repos/' })
    const data = res.data || res
    const list = data.list || []
    repoOperationList.value = list.map(r => ({
      username: r.username || '-',
      actionType: r.action_type || '',
      target: r.target_name || r.request_path || '',
      ip: r.request_ip || '-',
      timestamp: r.timestamp,
    }))
  } catch {
    repoOperationList.value = []
    ElMessage.warning('获取仓库操作失败')
  } finally {
    loadingRepo.value = false
  }
}

// 活跃用户弹窗
const showActiveDialog = ref(false)
const loadingActive = ref(false)
const activeUserList = ref([])

async function showActiveUsers() {
  showActiveDialog.value = true
  loadingActive.value = true
  try {
    const { getAuditLogs } = await import('@/api/audit')
    // 获取最近 1000 条日志，按用户名分组统计
    const res = await getAuditLogs({ page: 1, pageSize: 1000 })
    const data = res.data || res
    const list = data.list || []
    const userMap = {}
    for (const log of list) {
      if (!log.username) continue // 跳过 null 用户名，与后端统计一致
      if (!userMap[log.username]) userMap[log.username] = { username: log.username, ip: log.request_ip || '-', count: 0 }
      userMap[log.username].count++
      if (log.request_ip) userMap[log.username].ip = log.request_ip
    }
    activeUserList.value = Object.values(userMap).sort((a, b) => b.count - a.count)
  } catch {
    activeUserList.value = []
    ElMessage.warning('获取活跃用户失败')
  } finally {
    loadingActive.value = false
  }
}

onMounted(() => {
  loadStats()
  loadReports()
})

async function loadStats() {
  try {
    const res = await getAuditStats()
    const data = res.data || res
    if (data) {
      stats.totalOperations = data.totalOperations || data.total || 0
      stats.totalUsers = data.totalUsers || data.users || 0
      stats.totalRepos = data.totalRepos || data.repos || 0
      stats.riskCount = data.riskCount || data.risks || 0
    }
  } catch (error) {
    ElMessage.warning('加载统计数据失败')
  }
}

async function loadReports() {
  try {
    const res = await getAuditReports({ page: 1, pageSize: 20 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    reportList.value = (Array.isArray(list) ? list : []).map(r => ({
      id: r.report_id || r.id,
      name: r.name || '',
      dateRange: r.parameters ? (() => { try { const p = typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters; return [p.startDate, p.endDate].filter(Boolean).join(' 至 ') } catch { return '' } })() : '',
      createdAt: r.created_at ? formatTime(r.created_at) : '-',
      status: r.status || '',
      file_path: r.file_path || '',
    }))
  } catch (error) {
    ElMessage.warning('加载报表列表失败')
  }
}

async function generateReportHandler() {
  try {
    const params = {
      type: reportForm.type,
      format: reportForm.format
    }
    if (reportForm.dateRange && reportForm.dateRange.length === 2) {
      params.startDate = reportForm.dateRange[0]
      params.endDate = reportForm.dateRange[1]
    }
    ElMessage.info('报表生成中，请稍候...')
    await generateReport(params)
    ElMessage.success('报表生成成功')
    loadReports()
  } catch (error) {
    ElMessage.warning('报表生成失败')
  }
}

async function downloadReport(row) {
  const token = sessionStorage.getItem('gitea_token')
  if (!token) {
    ElMessage.warning('登录已过期，请重新登录')
    return
  }
  // 后端根据报表存储的 format 字段返回对应格式文件（CSV/TXT）
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/bff'
  const url = `${baseURL}/reports/${row.id}/export?token=${encodeURIComponent(token)}`
  window.open(url, '_blank')
}

async function deleteReport(row) {
  try {
    await ElMessageBox.confirm('确定要删除该报表吗？', '删除确认', { type: 'warning' })
    const { deleteReport: delReport } = await import('@/api/bff')
    await delReport(row.id)
    ElMessage.success('报表已删除')
    loadReports()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.warning('删除报表失败')
    }
  }
}

function getActionTypeName(type) {
  const map = { login: '登录', view: '查看', create: '创建', update: '更新', delete: '删除', approval: '审批', merge: '合并', commit: '提交', version: '版本', download: '下载' }
  return map[type] || type
}

function formatTime(time) {
  if (!time) return '-'
  const d = new Date(time)
  if (isNaN(d.getTime())) return time
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

</script>

<style lang="scss" scoped>
.report-stats {
  margin-bottom: 20px;
  
  .stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 24px;
    color: #fff;
    text-align: center;

    &.clickable {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
    }
    
    .stat-label {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
  }
}

.report-card {
  margin-bottom: 20px;
}
</style>
