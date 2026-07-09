<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">风险预警</h2>
      <el-badge :value="warningCount" :hidden="warningCount === 0">
        <span class="warning-tip">共 {{ warningCount }} 条未处理预警</span>
      </el-badge>
    </div>

    <el-alert type="warning" :closable="false" class="warning-alert">
      以下风险行为已被系统检测，请及时处理。
    </el-alert>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="预警级别">
          <el-select v-model="filterForm.level" clearable style="width: 150px">
            <el-option label="高危" value="high" />
            <el-option label="中危" value="medium" />
            <el-option label="低危" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警类型">
          <el-select v-model="filterForm.type" clearable style="width: 180px">
            <el-option label="异常登录" value="login_abnormal" />
            <el-option label="高频下载" value="download_frequent" />
            <el-option label="越权访问" value="permission_violation" />
            <el-option label="数据外泄风险" value="data_leak" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" clearable style="width: 150px">
            <el-option label="待处理" value="pending" />
            <el-option label="已处理" value="handled" />
            <el-option label="已忽略" value="ignored" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="warningList" v-loading="loading" stripe border>
      <el-table-column label="级别" width="100">
        <template #default="{ row }">
          <el-tag :type="getLevelTagType(row.level)" size="small">
            {{ getLevelName(row.level) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          <el-tag type="warning" size="small">{{ getTypeName(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="预警内容" min-width="300">
        <template #default="{ row }">
          <div class="warning-content">
            <p>{{ row.description }}</p>
            <span class="warning-detail">用户: {{ row.username }} | {{ row.time }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'pending' ? 'warning' : 'info'" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理人" width="100">
        <template #default="{ row }">
          {{ row.handler || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleWarning(row)" v-if="row.status === 'pending'">处理</el-button>
          <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
          <el-button type="danger" link @click="ignoreWarning(row)" v-if="row.status === 'pending'">忽略</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadWarnings"
      />
    </div>

    <el-dialog v-model="handleDialogVisible" title="处理预警" width="500px">
      <el-form :model="handleForm" label-width="100px">
        <el-form-item label="处理方式">
          <el-radio-group v-model="handleForm.action">
            <el-radio label="block">阻断操作</el-radio>
            <el-radio label="notify">通知用户</el-radio>
            <el-radio label="freeze">冻结账号</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理说明">
          <el-input v-model="handleForm.comment" type="textarea" :rows="4" placeholder="请输入处理说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const handleDialogVisible = ref(false)

const filterForm = reactive({
  level: '',
  type: '',
  status: 'pending'
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const warningList = ref([
  { id: 1, level: 'high', type: 'login_abnormal', description: 'IP 192.168.1.100 多次登录失败，疑似暴力破解', username: 'test_user', time: '2024-01-15 10:30', status: 'pending' },
  { id: 2, level: 'medium', type: 'download_frequent', description: '用户 zhangsan 短时间内下载次数超过阈值(50次)', username: 'zhangsan', time: '2024-01-15 09:45', status: 'pending' },
  { id: 3, level: 'low', type: 'permission_violation', description: '用户 lisi 尝试访问非授权仓库', username: 'lisi', time: '2024-01-14 16:20', status: 'handled', handler: '系统管理员' }
])

const currentWarning = ref(null)

const handleForm = reactive({
  action: 'notify',
  comment: ''
})

const warningCount = computed(() => warningList.value.filter(w => w.status === 'pending').length)

onMounted(() => {
  loadWarnings()
})

function loadWarnings() {
  loading.value = true
  setTimeout(() => {
    pagination.total = warningList.value.length
    loading.value = false
  }, 300)
}

function handleFilter() {
  loadWarnings()
}

function handleWarning(row) {
  currentWarning.value = row
  handleDialogVisible.value = true
}

function submitHandle() {
  ElMessage.success('预警处理成功')
  handleDialogVisible.value = false
  loadWarnings()
}

function viewDetail(row) {
  ElMessage.info('查看预警详情')
}

function ignoreWarning(row) {
  ElMessage.success('预警已忽略')
  loadWarnings()
}

function getLevelTagType(level) {
  const map = { 'high': 'danger', 'medium': 'warning', 'low': 'info' }
  return map[level] || 'info'
}

function getLevelName(level) {
  const map = { 'high': '高危', 'medium': '中危', 'low': '低危' }
  return map[level] || level
}

function getTypeName(type) {
  const map = { 'login_abnormal': '异常登录', 'download_frequent': '高频下载', 'permission_violation': '越权访问', 'data_leak': '数据外泄' }
  return map[type] || type
}

function getStatusName(status) {
  const map = { 'pending': '待处理', 'handled': '已处理', 'ignored': '已忽略' }
  return map[status] || status
}
</script>

<style lang="scss" scoped>
.warning-tip {
  color: #909399;
}

.warning-content {
  p {
    margin: 0 0 5px;
    color: #303133;
  }
  
  .warning-detail {
    font-size: 12px;
    color: #909399;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
