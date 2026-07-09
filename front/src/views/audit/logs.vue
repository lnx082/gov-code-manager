<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">操作日志</h2>
      <div class="button-group">
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出日志
        </el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="操作时间">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="操作用户">
          <el-input v-model="filterForm.username" placeholder="请输入用户名" clearable />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filterForm.actionType" placeholder="选择类型" clearable style="width: 150px">
            <el-option label="登录" value="login" />
            <el-option label="提交" value="commit" />
            <el-option label="合并" value="merge" />
            <el-option label="版本" value="version" />
            <el-option label="下载" value="download" />
            <el-option label="删除" value="delete" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作对象">
          <el-input v-model="filterForm.target" placeholder="仓库/版本名称" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">搜索</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-alert type="warning" :closable="false" class="security-alert">
      <template #title>
        <el-icon><Lock /></el-icon>
        安全提示：审计日志受防篡改保护，所有操作记录将永久留存，不可删除或修改。
      </template>
    </el-alert>

    <el-table :data="logList" v-loading="loading" stripe border>
      <el-table-column type="index" width="50" />
      <el-table-column label="时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column prop="username" label="操作用户" width="120" />
      <el-table-column label="操作类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getActionTypeTag(row.actionType)" size="small">{{ getActionTypeName(row.actionType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作详情" min-width="300">
        <template #default="{ row }">
          <div class="action-detail">
            <span class="action-target">{{ row.target }}</span>
            <span class="action-desc">{{ row.description }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP地址" width="140" />
      <el-table-column label="结果" width="100">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        @size-change="loadLogs"
        @current-change="loadLogs"
      />
    </div>

    <el-dialog v-model="detailDialogVisible" title="日志详情" width="700px">
      <el-descriptions v-if="currentLog" :column="1" border>
        <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
        <el-descriptions-item label="时间">{{ formatTime(currentLog.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="操作用户">{{ currentLog.username }}</el-descriptions-item>
        <el-descriptions-item label="用户角色">{{ currentLog.role }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ getActionTypeName(currentLog.actionType) }}</el-descriptions-item>
        <el-descriptions-item label="操作对象">{{ currentLog.target }}</el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ currentLog.ip }}</el-descriptions-item>
        <el-descriptions-item label="操作结果">
          <el-tag :type="currentLog.success ? 'success' : 'danger'" size="small">
            {{ currentLog.success ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="User-Agent">{{ currentLog.userAgent }}</el-descriptions-item>
        <el-descriptions-item label="操作描述">{{ currentLog.description }}</el-descriptions-item>
        <el-descriptions-item label="变更详情">
          <pre class="detail-json">{{ JSON.stringify(currentLog.details, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const detailDialogVisible = ref(false)

const filterForm = reactive({
  dateRange: [],
  username: '',
  actionType: '',
  target: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const logList = ref([
  { id: 'LOG-2024-001', timestamp: '2024-01-15 10:30:25', username: '张三', role: '开发人员', actionType: 'commit', target: 'gov-user-service', description: '提交代码到 feature/auth 分支', ip: '192.168.1.100', success: true, userAgent: 'git/2.39.0', details: { branch: 'feature/auth', files: 3, additions: 150, deletions: 20 } },
  { id: 'LOG-2024-002', timestamp: '2024-01-15 10:25:00', username: '李四', role: '项目管理员', actionType: 'merge', target: 'gov-user-service', description: '合并 feature/auth 到 develop', ip: '192.168.1.101', success: true, userAgent: 'Mozilla/5.0', details: { source: 'feature/auth', target: 'develop', commits: 5 } },
  { id: 'LOG-2024-003', timestamp: '2024-01-15 10:20:15', username: '王五', role: '开发人员', actionType: 'download', target: 'gov-system-v1.0.0', description: '下载版本压缩包', ip: '192.168.1.102', success: true, userAgent: 'Mozilla/5.0', details: { version: 'v1.0.0', size: '125MB' } }
])

const currentLog = ref(null)

onMounted(() => {
  loadLogs()
})

function loadLogs() {
  loading.value = true
  setTimeout(() => {
    pagination.total = 156
    loading.value = false
  }, 300)
}

function handleFilter() {
  pagination.page = 1
  loadLogs()
}

function resetFilter() {
  Object.keys(filterForm).forEach(key => filterForm[key] = '')
  loadLogs()
}

function handleExport() {
  ElMessage.success('日志导出功能开发中')
}

function viewDetail(row) {
  currentLog.value = row
  detailDialogVisible.value = true
}

function getActionTypeTag(type) {
  const map = { 'login': 'primary', 'commit': 'success', 'merge': 'warning', 'version': 'info', 'download': 'danger', 'delete': 'danger' }
  return map[type] || 'info'
}

function getActionTypeName(type) {
  const map = { 'login': '登录', 'commit': '提交', 'merge': '合并', 'version': '版本', 'download': '下载', 'delete': '删除' }
  return map[type] || type
}

function formatTime(time) {
  if (!time) return '-'
  return time
}
</script>

<style lang="scss" scoped>
.security-alert {
  margin-bottom: 20px;
  
  :deep(.el-alert__title) {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.action-detail {
  .action-target {
    color: #409eff;
    font-weight: 500;
    margin-right: 8px;
  }
  
  .action-desc {
    color: #606266;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.detail-json {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  max-height: 200px;
  margin: 0;
}
</style>
