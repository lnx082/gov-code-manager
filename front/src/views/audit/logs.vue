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
          <el-select v-model="filterForm.username" placeholder="选择用户" clearable filterable style="width: 180px">
            <el-option v-for="u in userOptions" :key="u.gitea_username" :label="u.gitea_username" :value="u.gitea_username" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filterForm.actionType" placeholder="选择类型" clearable style="width: 150px">
            <el-option label="登录" value="login" />
            <el-option label="查看" value="view" />
            <el-option label="创建" value="create" />
            <el-option label="更新" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="审批" value="approval" />
            <el-option label="合并" value="merge" />
            <el-option label="提交" value="commit" />
            <el-option label="版本" value="version" />
            <el-option label="下载" value="download" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作对象">
          <el-select v-model="filterForm.target" placeholder="选择仓库" clearable filterable style="width: 180px">
            <el-option v-for="r in repoOptions" :key="r.full_name" :label="r.displayName" :value="r.full_name" />
          </el-select>
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

    <div class="table-responsive">
      <el-table :data="logList" v-loading="loading" stripe border @row-contextmenu.prevent="openMenu">
      <el-table-column type="index" width="50" />
      <el-table-column label="时间" width="180" class="col-hide-mobile">
        <template #default="{ row }">
          {{ formatTime(row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column prop="username" label="操作用户" width="120" class="col-hide-mobile" />
      <el-table-column label="操作类型" width="100" class="col-hide-mobile">
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
      <el-table-column prop="ip" label="IP地址" width="140" class="col-hide-mobile" />
      <el-table-column label="结果" width="100" class="col-hide-mobile">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
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
        v-model:page-size="pagination.pageSize"
        :page-sizes="[20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
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

    <RowContextMenu :visible="visible" :position="position" :actions="currentRow ? getActions(currentRow) : []" @close="closeMenu" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { View, MoreFilled } from '@element-plus/icons-vue'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'
import { getAuditLogs, exportAuditLogs } from '@/api/audit'
import { getUserList, getFilteredRepos } from '@/api/bff'

const loading = ref(false)
const detailDialogVisible = ref(false)
const userOptions = ref([])
const repoOptions = ref([])

async function loadUsers() {
  try {
    const res = await getUserList({ page: 1, pageSize: 200 })
    const list = res.data?.list || []
    userOptions.value = list.filter(u => u.gitea_username)
  } catch {
    userOptions.value = []
  }
}

async function loadRepoList() {
  try {
    const res = await getFilteredRepos({ page: 1, pageSize: 200 })
    const data = res.data || res
    const list = data.list || []
    // 解析中文显示名
    repoOptions.value = list.map(r => {
      const desc = r.description || ''
      const match = desc.match(/\[显示名=([^\]]+)\]/)
      const displayName = match ? match[1] : (r.full_name || r.name)
      return { ...r, displayName, full_name: r.full_name || r.name }
    })
  } catch {
    repoOptions.value = []
  }
}

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

const logList = ref([])
const currentLog = ref(null)

onMounted(() => {
  loadUsers()
  loadRepoList()
  loadLogs()
})

async function loadLogs() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startTime = filterForm.dateRange[0]
      params.endTime = filterForm.dateRange[1]
    }
    if (filterForm.username) params.username = filterForm.username
    if (filterForm.actionType) params.actionType = filterForm.actionType
    if (filterForm.target) params.target = filterForm.target

    const res = await getAuditLogs(params)
    const data = res.data || res
    const list = data.list || data.records || data || []
    // 映射后端字段名 → 前端模板字段
    logList.value = (Array.isArray(list) ? list : []).map(r => ({
      id: r.log_id || r.id,
      timestamp: r.timestamp,
      username: r.username,
      actionType: r.action_type,
      actionName: r.action_name,
      target: r.target_name || r.request_path || '',
      description: r.action_name || '',
      ip: r.request_ip || '-',
      request_ip: r.request_ip,
      result: r.result,
      success: r.result === 'success',
      role: r.role_code || '',
      userAgent: r.request_user_agent || '',
      details: r,
    }))
    pagination.total = data.total || logList.value.length
  } catch (error) {
    ElMessage.warning('加载审计日志失败')
    logList.value = []
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  pagination.page = 1
  loadLogs()
}

function resetFilter() {
  Object.keys(filterForm).forEach(key => filterForm[key] = '')
  loadLogs()
}

async function handleExport() {
  try {
    const params = {}
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startTime = filterForm.dateRange[0]
      params.endTime = filterForm.dateRange[1]
    }
    if (filterForm.username) params.username = filterForm.username
    if (filterForm.actionType) params.actionType = filterForm.actionType
    if (filterForm.target) params.target = filterForm.target

    const res = await exportAuditLogs(params)
    // 创建下载链接
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `审计日志_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('日志导出成功')
  } catch (error) {
    ElMessage.warning('日志导出失败')
  }
}

function viewDetail(row) {
  currentLog.value = row
  detailDialogVisible.value = true
}

function getActionTypeTag(type) {
  const map = {
    login: 'primary', view: '', create: 'success', update: 'warning',
    delete: 'danger', approval: 'primary', merge: 'warning',
    commit: 'success', version: 'info', download: 'danger'
  }
  return map[type] || 'info'
}

function getActionTypeName(type) {
  const map = {
    login: '登录', view: '查看', create: '创建', update: '更新',
    delete: '删除', approval: '审批', merge: '合并',
    commit: '提交', version: '版本', download: '下载'
  }
  return map[type] || type
}

function formatTime(time) {
  if (!time) return '-'
  const d = new Date(time)
  if (isNaN(d.getTime())) return time
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 移动端溢出菜单
const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '详情', icon: View, onClick: () => viewDetail(row) }
  ]
}

function onTrigger(row, event) {
  openMenu(row, event)
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
}
</style>
