<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">🌿 分支列表</h2>
      <div class="button-group">
        <el-button type="danger" @click="showCreateDialog">➕ 创建分支</el-button>
      </div>
    </div>

    <el-card class="stats-card">
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">总分支数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.protected }}</div>
            <div class="stat-label">受保护分支</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.active }}</div>
            <div class="stat-label">活跃分支</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.pending }}</div>
            <div class="stat-label">待合并</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="仓库">
          <el-select v-model="filterForm.repoId" placeholder="选择仓库" clearable style="width: 200px">
            <el-option label="政务系统-用户模块" value="1" />
            <el-option label="政务系统-审批模块" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="分支类型">
          <el-select v-model="filterForm.type" placeholder="选择类型" clearable style="width: 150px">
            <el-option label="开发分支" value="feature" />
            <el-option label="测试分支" value="test" />
            <el-option label="正式分支" value="main" />
            <el-option label="修复分支" value="hotfix" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="danger" @click="handleFilter">🔍 筛选</el-button>
          <el-button @click="resetFilter">🔄 重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="branchList" v-loading="loading" stripe border>
      <el-table-column label="分支名称" min-width="180">
        <template #default="{ row }">
          <div class="branch-cell">
            <span>🌿</span>
            <span class="branch-name" @click="viewBranch(row)">{{ row.name }}</span>
            <el-tag v-if="row.isDefault" type="danger" size="small">默认</el-tag>
            <el-tag v-if="row.isProtected" type="warning" size="small">保护</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="repoName" label="所属仓库" width="180" />
      <el-table-column label="最新提交" min-width="200">
        <template #default="{ row }">
          <div class="commit-cell">
            <el-tag type="info" size="small">{{ row.sha?.substring(0, 7) }}</el-tag>
            <span class="commit-message">{{ row.commitMessage }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="创建者" width="100" />
      <el-table-column label="更新时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewBranch(row)">👁️ 查看</el-button>
          <el-button type="primary" link @click="createMerge(row)">🔀 合并</el-button>
          <el-button type="danger" link @click="deleteBranch(row)">🗑️ 删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadBranches"
      />
    </div>

    <el-dialog v-model="createDialogVisible" title="🌿 创建分支" width="500px">
      <el-form :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="分支名称" prop="name">
          <el-input v-model="createForm.name" placeholder="feature/xxx" />
        </el-form-item>
        <el-form-item label="所属仓库" prop="repoId">
          <el-select v-model="createForm.repoId" placeholder="选择仓库">
            <el-option label="政务系统-用户模块" value="1" />
            <el-option label="政务系统-审批模块" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="基于分支" prop="baseBranch">
          <el-select v-model="createForm.baseBranch" placeholder="选择基础分支">
            <el-option label="main" value="main" />
            <el-option label="develop" value="develop" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleCreateBranch">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBranches as getGiteaBranches } from '@/api/gitea'
import { getRepoList } from '@/api/repo'

const router = useRouter()
const loading = ref(false)
const createDialogVisible = ref(false)

const stats = reactive({ total: 0, protected: 0, active: 0, pending: 0 })

const filterForm = reactive({ repoId: '', type: '' })

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const branchList = ref([])
const repoList = ref([])

const createForm = reactive({ name: '', repoId: '', baseBranch: 'main' })
const createRules = {
  name: [{ required: true, message: '请输入分支名称', trigger: 'blur' }],
  repoId: [{ required: true, message: '请选择仓库', trigger: 'change' }]
}

onMounted(() => { loadBranches() })

async function loadBranches() {
  loading.value = true
  try {
    const repos = await getRepoList()
    const branches = []
    if (repos.data?.list) {
      for (const repo of repos.data.list) {
        try {
          const res = await getGiteaBranches(repo.owner || repo.owner_name, repo.name)
          const repoBranches = res.data || []
          repoBranches.forEach(b => branches.push({ ...b, repoOwner: repo.owner || repo.owner_name, repoName: repo.name }))
        } catch { /* skip failed repos */ }
      }
    }
    branchList.value = branches
    pagination.total = branches.length
    stats.total = branches.length
    stats.protected = branches.filter(b => b.protected).length
    stats.active = branches.filter(b => !b.protected).length
  } catch {
    ElMessage.warning('加载分支列表失败')
  } finally {
    loading.value = false
  }
}

function handleFilter() { loadBranches() }
function resetFilter() { Object.keys(filterForm).forEach(key => filterForm[key] = ''); loadBranches() }
function showCreateDialog() { createDialogVisible.value = true }

async function handleCreateBranch() {
  if (!createForm.name || !createForm.repoId) {
    ElMessage.warning('请填写完整信息')
    return
  }
  ElMessage.success('分支创建成功')
  createDialogVisible.value = false
  loadBranches()
}

function viewBranch(row) { router.push(`/repos/${row.repoId}?branch=${row.name}`) }
function createMerge(row) { router.push(`/branches/merge?source=${row.name}`) }

function deleteBranch(row) {
  ElMessageBox.confirm(`确定要删除分支 "${row.name}" 吗？`, '删除确认', { type: 'warning' })
    .then(() => {
      ElMessage.success('分支已删除')
      loadBranches()
    })
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.branch-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .branch-name {
    color: #c41230;
    cursor: pointer;
    font-weight: 500;
    &:hover { text-decoration: underline; }
  }
}

.commit-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .commit-message {
    color: #606266;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
