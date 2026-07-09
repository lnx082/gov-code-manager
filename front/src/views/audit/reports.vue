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
          <el-button type="primary" @click="generateReport">
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
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const stats = reactive({
  totalOperations: 12580,
  totalUsers: 45,
  totalRepos: 128,
  riskCount: 12
})

const reportForm = reactive({
  type: 'version',
  dateRange: [],
  format: 'pdf'
})

const reportList = ref([
  { id: 1, name: '2024年1月版本变更统计报表', type: 'version', dateRange: '2024-01-01 至 2024-01-15', creator: '系统', createdAt: '2024-01-15 10:00' },
  { id: 2, name: '2024年1月操作审计报表', type: 'audit', dateRange: '2024-01-01 至 2024-01-15', creator: '系统', createdAt: '2024-01-15 09:00' }
])

function generateReport() {
  ElMessage.success('报表生成中，请稍候...')
  setTimeout(() => {
    ElMessage.success('报表生成成功')
  }, 2000)
}

function downloadReport(row) {
  ElMessage.success(`开始下载: ${row.name}`)
}

function deleteReport(row) {
  ElMessageBox.confirm('确定要删除该报表吗？', '删除确认', { type: 'warning' })
    .then(() => {
      ElMessage.success('报表已删除')
    })
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
