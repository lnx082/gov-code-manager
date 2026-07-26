<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">备份管理</h2>
      <el-button type="primary" @click="handleCreateBackup">
        <el-icon><Plus /></el-icon>
        创建备份
      </el-button>
    </div>

    <div class="table-responsive">
      <el-table :data="backupList" v-loading="loading" stripe border @row-contextmenu.prevent="openMenu">
      <el-table-column prop="name" label="备份名称" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'manual' ? 'primary' : 'info'" size="small">
            {{ row.type === 'manual' ? '手动' : '自动' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="120">
        <template #default="{ row }">
          {{ formatSize(row.file_size) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="150">
        <template #default="{ row }">
          <el-progress v-if="row.status === 'running'" :percentage="row.progress" />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_by" label="创建人" width="120" />
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.start_time) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="handleRestore(row)" :disabled="row.status !== 'completed'">恢复</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
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
        @current-change="loadBackups"
      />
    </div>

    <RowContextMenu :visible="visible" :position="position" :actions="currentRow ? getActions(currentRow) : []" @close="closeMenu" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, MoreFilled } from '@element-plus/icons-vue'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'
import { getBackupList, createBackup, restoreBackup, deleteBackup } from '@/api/admin'

const loading = ref(false)
const backupList = ref([])
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

onMounted(() => {
  loadBackups()
})

async function loadBackups() {
  loading.value = true
  try {
    const res = await getBackupList({
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    backupList.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch (error) {
    ElMessage.error('加载备份列表失败')
  } finally {
    loading.value = false
  }
}

async function handleCreateBackup() {
  try {
    await createBackup({
      name: `备份-${new Date().toISOString()}`,
      type: 'manual',
      scope: 'full'
    })
    ElMessage.success('备份任务已创建')
    setTimeout(loadBackups, 1000)
  } catch (error) {
    ElMessage.error('创建备份失败')
  }
}

async function handleRestore(row) {
  try {
    await ElMessageBox.confirm('确定要恢复该备份吗？这将覆盖当前数据！', '恢复确认', { type: 'warning' })
    await restoreBackup(row.backup_id)
    ElMessage.success('恢复任务已创建')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('恢复失败')
    }
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除该备份吗？', '删除确认', { type: 'warning' })
    await deleteBackup(row.backup_id)
    ElMessage.success('删除成功')
    loadBackups()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

function getStatusType(status) {
  const map = { 'running': 'warning', 'completed': 'success', 'failed': 'danger' }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = { 'running': '进行中', 'completed': '已完成', 'failed': '失败' }
  return map[status] || status
}

function formatSize(bytes) {
  if (!bytes) return '-'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

// 移动端溢出菜单
const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '恢复', icon: Refresh, disabled: row.status !== 'completed', onClick: () => handleRestore(row) },
    { label: '删除', icon: Delete, type: 'danger', divided: true, onClick: () => handleDelete(row) }
  ]
}

function onTrigger(row, event) {
  openMenu(row, event)
}
</script>

<style lang="scss" scoped>
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
