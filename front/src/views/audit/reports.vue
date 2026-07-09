<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">审计报表</h2>
    </div>

    <el-row :gutter="20" class="report-stats">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalOperations }}</div>
          <div class="stat-label">总操作数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-label">活跃用户</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalRepos }}</div>
          <div class="stat-label">仓库操作</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
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
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ getTypeName(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dateRange" label="时间范围" width="200" />
        <el-table-column prop="creator" label="生成人" width="100" />
        <el-table-column label="生成时间" width="160">
          <template #default="{ row }">
            {{ row.createdAt }}
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAuditReports, generateReport, exportReport } from '@/api/audit'
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
    reportList.value = Array.isArray(list) ? list : []
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
  try {
    await exportReport(row.id)
    ElMessage.success(`开始下载: ${row.name}`)
  } catch (error) {
    ElMessage.warning('报表下载失败')
  }
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

function getTypeName(type) {
  const map = { 'version': '版本变更', 'audit': '操作审计', 'approval': '审批汇总', 'risk': '风险预警' }
  return map[type] || type
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
