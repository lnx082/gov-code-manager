<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">归档管理</h2>
    </div>

    <el-alert type="warning" :closable="false" class="warning-alert">
      归档后的版本将不能用于新的迭代和上线申请，仅保留备查功能。
    </el-alert>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="归档类型">
          <el-select v-model="filterForm.type" clearable style="width: 150px">
            <el-option label="测试归档" value="test" />
            <el-option label="废弃归档" value="abandoned" />
            <el-option label="历史归档" value="historical" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="filterForm.repoId" placeholder="选择仓库" clearable style="width: 200px">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.name" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="archiveList" v-loading="loading" stripe border>
      <el-table-column label="版本号" width="150">
        <template #default="{ row }">
          <div class="archive-cell">
            <el-icon><Box /></el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="repoName" label="所属仓库" width="180" />
      <el-table-column label="归档类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getTypeTagType(row.type)" size="small">{{ getTypeName(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="archiveReason" label="归档原因" min-width="200" show-overflow-tooltip />
      <el-table-column prop="archiver" label="归档人" width="100" />
      <el-table-column label="归档时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.archivedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewDetail(row)">查看</el-button>
          <el-button type="primary" link @click="restore(row)">恢复</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadArchives"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getArchiveList, restoreArchive } from '@/api/admin'
import { getMyRepos } from '@/api/gitea'
import { getRepoList } from '@/api/repo'

const loading = ref(false)

const filterForm = reactive({
  type: '',
  repoId: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const archiveList = ref([])
const repoList = ref([])

onMounted(() => {
  loadArchives()
  loadRepos()
})

async function loadArchives() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      type: filterForm.type || undefined,
      repoId: filterForm.repoId || undefined
    }
    const res = await getArchiveList(params)
    const data = res.data || res
    const list = data.list || data.records || data || []
    archiveList.value = Array.isArray(list) ? list : []
    pagination.total = data.total || archiveList.value.length
  } catch (error) {
    ElMessage.warning('加载归档列表失败')
    archiveList.value = []
  } finally {
    loading.value = false
  }
}

async function loadRepos() {
  try {
    // Try Gitea API first for richer repo data
    const res = await getMyRepos()
    const repos = res.data || res
    repoList.value = (Array.isArray(repos) ? repos : []).map(r => ({
      id: r.id,
      name: r.full_name || r.name
    }))
  } catch {
    // Fall back to BFF repo list
    try {
      const res = await getRepoList({ page: 1, pageSize: 100 })
      const repos = res.data?.list || res.data || res || []
      repoList.value = (Array.isArray(repos) ? repos : []).map(r => ({
        id: r.id,
        name: r.full_name || r.name || r.path
      }))
    } catch (fallbackError) {
      ElMessage.warning('加载仓库列表失败')
    }
  }
}

function handleFilter() {
  pagination.page = 1
  loadArchives()
}

function viewDetail(row) {
  ElMessage.info('查看归档详情功能开发中')
}

async function restore(row) {
  try {
    await ElMessageBox.confirm(`确定要恢复版本 "${row.name}" 吗？`, '恢复版本', { type: 'warning' })
    await restoreArchive(row.id)
    ElMessage.success('版本已恢复')
    loadArchives()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.warning('恢复版本失败')
    }
  }
}

function getTypeTagType(type) {
  const map = { 'test': 'info', 'abandoned': 'danger', 'historical': 'warning' }
  return map[type] || 'info'
}

function getTypeName(type) {
  const map = { 'test': '测试归档', 'abandoned': '废弃归档', 'historical': '历史归档' }
  return map[type] || type
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.warning-alert {
  margin-bottom: 20px;
}

.archive-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
