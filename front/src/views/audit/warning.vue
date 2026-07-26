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
            <el-option label="待处理" value="unhandled" />
            <el-option label="已处理" value="handled" />
            <el-option label="已忽略" value="ignored" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="table-responsive">
      <el-table :data="warningList" v-loading="loading" stripe border @row-contextmenu.prevent="openMenu">
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
          <el-tag :type="(row.status === 'unhandled' || row.status === 'pending') ? 'warning' : 'info'" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理人" width="100">
        <template #default="{ row }">
          {{ row.handler || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="handleWarning(row)" v-if="row.status === 'unhandled' || row.status === 'pending'">处理</el-button>
            <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
            <el-button type="danger" link @click="ignoreWarning(row)" v-if="row.status === 'unhandled' || row.status === 'pending'">忽略</el-button>
          </span>
          <el-button class="action-more-btn" size="small" @click.stop="onTrigger(row, $event)">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next, jumper"
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

    <!-- 预警详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="预警详情" width="550px">
      <div v-if="currentWarning" class="warning-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="预警标题">{{ currentWarning.title || '-' }}</el-descriptions-item>
          <el-descriptions-item label="预警内容">{{ currentWarning.description || '-' }}</el-descriptions-item>
          <el-descriptions-item label="预警级别">
            <el-tag :type="currentWarning.level === 'high' ? 'danger' : currentWarning.level === 'medium' ? 'warning' : 'info'" size="small">
              {{ currentWarning.level === 'high' ? '高危' : currentWarning.level === 'medium' ? '中危' : '低危' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="相关用户">{{ currentWarning.username || '-' }}</el-descriptions-item>
          <el-descriptions-item label="来源 IP">{{ currentWarning.source_ip || '-' }}</el-descriptions-item>
          <el-descriptions-item label="触发规则">{{ currentWarning.triggered_rule || '-' }}</el-descriptions-item>
          <el-descriptions-item label="触发时间">{{ currentWarning.time || '-' }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">{{ currentWarning.status === 'handled' ? '已处理' : '未处理' }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <RowContextMenu :visible="visible" :position="position" :actions="menuRow ? getActions(menuRow) : []" @close="closeMenu" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { MoreFilled, View, Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getRiskWarnings, handleRiskWarning } from '@/api/bff'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'

const loading = ref(false)
const handleDialogVisible = ref(false)
const showDetailDialog = ref(false)

const filterForm = reactive({
  level: '',
  type: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const warningList = ref([])
const currentWarning = ref(null)

const handleForm = reactive({
  action: 'notify',
  comment: ''
})

const { visible, position, currentRow: menuRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '处理', icon: Check, visible: row.status === 'unhandled' || row.status === 'pending', onClick: () => handleWarning(row) },
    { label: '详情', icon: View, onClick: () => viewDetail(row) },
    { label: '忽略', icon: Close, type: 'danger', divided: true, visible: row.status === 'unhandled' || row.status === 'pending', onClick: () => ignoreWarning(row) }
  ]
}

function onTrigger(row, event) {
  openMenu(row, event)
}

const warningCount = computed(() => warningList.value.filter(w => w.status === 'pending').length)

onMounted(() => {
  loadWarnings()
})

async function loadWarnings() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    if (filterForm.level) params.level = filterForm.level
    if (filterForm.type) params.type = filterForm.type
    if (filterForm.status) params.status = filterForm.status

    const res = await getRiskWarnings(params)
    const data = res.data || res
    const list = data.list || data.records || data || []
    // 映射后端字段名 → 前端模板字段
    warningList.value = (Array.isArray(list) ? list : []).map(r => ({
      id: r.warning_id || r.id,
      level: r.level || 'low',
      type: r.type || '',
      title: r.title || '',
      description: r.description || r.title || '',
      username: r.related_username || '-',
      time: r.created_at || r.createdAt || '',
      status: r.status || 'pending',
      handler: r.handler_username || '',
      created_at: r.created_at,
      triggered_rule: r.triggered_rule || '',
      source_ip: r.source_ip || '',
    }))
    pagination.total = data.total || warningList.value.length
  } catch (error) {
    ElMessage.warning('加载风险预警失败')
    warningList.value = []
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  pagination.page = 1
  loadWarnings()
}

function handleWarning(row) {
  currentWarning.value = row
  handleForm.action = 'notify'
  handleForm.comment = ''
  handleDialogVisible.value = true
}

async function submitHandle() {
  if (!currentWarning.value) return
  try {
    await handleRiskWarning(currentWarning.value.id, {
      action: handleForm.action,
      comment: handleForm.comment
    })
    ElMessage.success('预警处理成功')
    handleDialogVisible.value = false
    loadWarnings()
  } catch (error) {
    ElMessage.warning('预警处理失败')
  }
}

function viewDetail(row) {
  currentWarning.value = row
  showDetailDialog.value = true
}

async function ignoreWarning(row) {
  try {
    await handleRiskWarning(row.id, { action: 'ignore' })
    ElMessage.success('预警已忽略')
    loadWarnings()
  } catch (error) {
    ElMessage.warning('忽略预警失败')
  }
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
  const map = { 'unhandled': '待处理', 'pending': '待处理', 'handled': '已处理', 'ignored': '已忽略' }
  return map[status] || status
}
</script>

<style lang="scss" scoped>
.warning-tip {
  color: #909399;
}

.warning-detail {
  .el-descriptions {
    margin-top: 10px;
  }
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

.action-btns-desktop { display: inline; }
.action-more-btn { display: none; }

@media (max-width: 768px) {
  .action-btns-desktop { display: none; }
  .action-more-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
    padding: 0 6px;
  }
  :deep(.action-col) {
    width: 50px !important;
    min-width: 50px !important;
  }
}
</style>
