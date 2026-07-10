<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">归档管理</h2>
      <el-button type="primary" @click="showCreateDialog" v-if="isPM">
        <el-icon><Plus /></el-icon> 添加归档
      </el-button>
    </div>

    <el-alert type="warning" :closable="false" class="warning-alert">
      归档后该仓库将被锁定为只读，不能提交代码、发布版本或创建新基线。
    </el-alert>

    <el-table :data="archiveList" v-loading="loading" stripe border>
      <el-table-column prop="tag_name" label="版本号" width="120" />
      <el-table-column label="所属仓库" width="200">
        <template #default="{ row }">{{ row.repo_owner }}/{{ row.repo_name }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '已归档' : row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="归档时间" width="160">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button type="primary" link @click="restore(row)" v-if="row.status === 'active'">恢复</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination v-model:current-page="pagination.page" :total="pagination.total" layout="total, prev, pager, next" @current-change="loadArchives" />
    </div>

    <el-dialog v-model="createDialogVisible" title="添加归档" width="600px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="筛选仓库">
          <el-select v-model="filterRepoId" placeholder="选择仓库" clearable style="width:100%">
            <el-option v-for="r in repoList" :key="r.id" :label="r.displayName" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择基线">
          <el-select v-model="createForm.baselineId" placeholder="选择要归档的基线" style="width:100%" filterable>
            <el-option v-for="b in filteredBaselines" :key="b.baseline_id" :label="`${b.baseline_name || b.name} (${b.tag_name || b.version})`" :value="b.baseline_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="归档说明">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="归档原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="submitting">提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getArchiveList, restoreArchive, getBaselineList } from '@/api/admin'
import { getMyRepos } from '@/api/gitea'
import { createApproval } from '@/api/bff'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const isPM = computed(() => userStore.role === 'project_manager')

const loading = ref(false)
const submitting = ref(false)
const createDialogVisible = ref(false)
const filterRepoId = ref('')
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const archiveList = ref([])
const repoList = ref([])
const baselines = ref([])

const createForm = reactive({ baselineId: '', description: '' })

const filteredBaselines = computed(() => {
  let list = baselines.value.filter(b => b.status === 'active')
  if (filterRepoId.value) {
    const repo = repoList.value.find(r => r.id === filterRepoId.value)
    if (repo) list = list.filter(b => b.repo_owner === repo.owner && b.repo_name === repo.repo)
  }
  return list
})

function parseDisplayName(desc, fallback) {
  if (!desc) return fallback || ''
  const m = desc.match(/\[显示名=([^\]]+)\]/)
  return m ? m[1] : (fallback || '')
}

onMounted(() => { loadArchives(); loadRepos() })

async function loadArchives() {
  loading.value = true
  try {
    const res = await getArchiveList({ page: pagination.page, pageSize: pagination.pageSize })
    const data = res.data || res
    archiveList.value = (data.list || data.records || data || [])
    pagination.total = data.total || archiveList.value.length
  } catch { archiveList.value = [] } finally { loading.value = false }
}

async function loadRepos() {
  try {
    const res = await getMyRepos({ page: 1, limit: 200 })
    const repos = res.data || res
    repoList.value = (Array.isArray(repos) ? repos : []).map(r => ({
      id: r.id, name: r.full_name || r.name, displayName: parseDisplayName(r.description, r.full_name || r.name),
      owner: r.owner?.login || '', repo: r.name
    }))
  } catch { repoList.value = [] }
}

async function showCreateDialog() {
  createForm.baselineId = ''; createForm.description = ''; filterRepoId.value = ''
  try {
    const res = await getBaselineList()
    baselines.value = (res.data?.list || res.data || [])
  } catch { baselines.value = [] }
  createDialogVisible.value = true
}

async function handleCreate() {
  if (!createForm.baselineId) { ElMessage.warning('请选择基线'); return }
  const baseline = baselines.value.find(b => b.baseline_id === createForm.baselineId)
  if (!baseline) { ElMessage.warning('基线不存在'); return }
  submitting.value = true
  try {
    await createApproval({
      operationType: 'baseline_archive',
      title: `归档申请: ${baseline.baseline_name || baseline.name || baseline.tag_name}`,
      description: createForm.description,
      repoOwner: baseline.repo_owner, repoName: baseline.repo_name,
      body: JSON.stringify({
        baselineId: baseline.baseline_id, repoOwner: baseline.repo_owner,
        repoName: baseline.repo_name, tagName: baseline.tag_name || baseline.version
      })
    })
    ElMessage.success('归档申请已提交，等待审批')
    createDialogVisible.value = false; loadArchives()
  } catch (e) {
    ElMessage.error('提交失败: ' + (e?.response?.data?.message || e?.message || ''))
  } finally { submitting.value = false }
}

async function restore(row) {
  try {
    await ElMessageBox.confirm('确定恢复该归档吗？仓库将重新开放。', '恢复', { type: 'warning' })
    await restoreArchive(row.archive_id)
    ElMessage.success('已恢复'); loadArchives()
  } catch (e) { if (e !== 'cancel') ElMessage.warning('恢复失败') }
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.warning-alert { margin-bottom: 20px; }
.pagination-wrapper { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>
