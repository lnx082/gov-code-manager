<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title"><el-icon><Share /></el-icon> 分支列表</h2>
      <div class="button-group">
        <el-button type="danger" @click="showCreateDialog"><el-icon><Plus /></el-icon> 创建分支</el-button>
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
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.displayName" :value="repo.id" />
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
          <el-button type="danger" @click="handleFilter"><el-icon><Search /></el-icon> 筛选</el-button>
          <el-button @click="resetFilter"><el-icon><Refresh /></el-icon> 重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="table-responsive">
      <el-table :data="branchList" v-loading="loading" stripe border @row-contextmenu.prevent="openMenu">
      <el-table-column label="分支名称" min-width="180">
        <template #default="{ row }">
          <div class="branch-cell">
            <el-icon><Share /></el-icon>
            <span class="branch-name" @click="viewBranch(row)">{{ row.name }}</span>
            <el-tag v-if="row.isDefault" type="danger" size="small">默认</el-tag>
            <el-tag v-if="row.isProtected" type="warning" size="small">保护</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="所属仓库" width="180" class="col-hide-mobile">
        <template #default="{ row }">
          {{ row.displayName || row.repoName }}
        </template>
      </el-table-column>
      <el-table-column label="最新提交" min-width="200" class="col-hide-mobile">
        <template #default="{ row }">
          <div class="commit-cell">
            <el-tag type="info" size="small">{{ row.sha?.substring(0, 7) }}</el-tag>
            <span class="commit-message">{{ row.commitMessage }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="创建者" width="100" class="col-hide-mobile" />
      <el-table-column label="更新时间" width="160" class="col-hide-mobile">
        <template #default="{ row }">
          {{ formatTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="50" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <div class="action-buttons">
              <el-button size="small" @click="viewBranch(row)"><el-icon><View /></el-icon> 查看</el-button>
              <el-button size="small" type="success" plain @click="createMerge(row)"><el-icon><Connection /></el-icon> 合并</el-button>
              <el-button size="small" type="danger" plain @click="deleteBranch(row)"><el-icon><Delete /></el-icon> 删除</el-button>
            </div>
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
        @current-change="loadBranches"
      />
    </div>

    <el-dialog v-model="createDialogVisible" title="创建分支" width="500px">
      <el-form :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="分支名称" prop="name">
          <el-input v-model="createForm.name" placeholder="feature/xxx" />
        </el-form-item>
        <el-form-item label="所属仓库" prop="repoId">
          <el-select v-model="createForm.repoId" placeholder="选择仓库">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.displayName" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="基于分支" prop="baseBranch">
          <el-select v-model="createForm.baseBranch" placeholder="选择基础分支">
            <el-option v-for="branch in baseBranches" :key="branch" :label="branch" :value="branch" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleCreateBranch">创建</el-button>
      </template>
    </el-dialog>

    <RowContextMenu
      :visible="visible"
      :position="position"
      :actions="currentRow ? getActions(currentRow) : []"
      @close="closeMenu"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBranches as getGiteaBranches } from '@/api/gitea'
import { getFilteredRepos } from '@/api/bff'
import { Share, Plus, Search, Refresh, View, Connection, Delete, MoreFilled } from '@element-plus/icons-vue'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'

const router = useRouter()
const loading = ref(false)
const createDialogVisible = ref(false)

const stats = reactive({ total: 0, protected: 0, active: 0, pending: 0 })

const filterForm = reactive({ repoId: '', type: '' })

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '查看', icon: View, onClick: () => viewBranch(row) },
    { label: '合并', icon: Connection, onClick: () => createMerge(row) },
    { label: '删除', icon: Delete, type: 'danger', divided: true, onClick: () => deleteBranch(row) },
  ]
}

const branchList = ref([])
const repoList = ref([])
const baseBranches = ref(['main', 'develop'])

const createForm = reactive({ name: '', repoId: '', baseBranch: 'main' })
const createRules = {
  name: [{ required: true, message: '请输入分支名称', trigger: 'blur' }],
  repoId: [{ required: true, message: '请选择仓库', trigger: 'change' }]
}

onMounted(() => { loadBranches() })

async function loadBranches() {
  loading.value = true
  try {
    // Load repo list from Gitea
    const reposRes = await getFilteredRepos({ page: 1, pageSize: 200 })
    const repos = reposRes.data?.list || reposRes.data || reposRes
    repoList.value = (Array.isArray(repos) ? repos : []).map(r => {
      return {
        id: r.id,
        name: r.full_name || r.name,
        displayName: r._display_name || r.full_name || r.name,
        owner: typeof r.owner === 'string' ? r.owner : (r.owner?.login || r.owner?.username || ''),
        repo: r.name,
        repoOwner: typeof r.owner === 'string' ? r.owner : (r.owner?.login || r.owner?.username || ''),
        repoName: r.name,
        defaultBranch: r.default_branch || 'main'
      }
    })

    // Load branches from each repo
    const reposToLoad = filterForm.repoId
      ? repoList.value.filter(r => r.id === filterForm.repoId)
      : repoList.value
    // 并发请求所有仓库的分支，提升加载速度
    const results = await Promise.allSettled(reposToLoad.map(async (repo) => {
      try {
        const res = await getGiteaBranches(repo.owner, repo.repo)
        const repoBranches = res.data || res
        const branchArray = Array.isArray(repoBranches) ? repoBranches : []
        return branchArray.map(b => ({
          ...b, repoId: repo.id, repoOwner: repo.owner, repoName: repo.repo,
          displayName: repo.displayName, sha: b.commit?.sha || b.sha || '',
          commitMessage: b.commit?.message || b.commitMessage || '',
          author: b.commit?.author?.name || b.commit?.committer?.name || b.author || '',
          updatedAt: b.commit?.author?.date || b.commit?.committer?.date || b.updatedAt || '',
          isDefault: b.name === repo.defaultBranch, isProtected: b.protected || false
        }))
      } catch { return [] }
    }))
    const branches = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
    pagination.total = branches.length
    stats.total = branches.length
    stats.protected = branches.filter(b => b.protected).length
    stats.active = branches.filter(b => !b.protected).length
    stats.pending = 0
    // 客户端分页
    const start = (pagination.page - 1) * pagination.pageSize
    branchList.value = branches.slice(start, start + pagination.pageSize)
  } catch {
    ElMessage.warning('加载分支列表失败')
  } finally {
    loading.value = false
  }
}

function handleFilter() { loadBranches() }
function resetFilter() { Object.keys(filterForm).forEach(key => filterForm[key] = ''); loadBranches() }
function showCreateDialog() {
  createForm.repoId = ''
  createForm.baseBranch = 'main'
  createDialogVisible.value = true
}

// Watch repoId change in create form to load base branches
watch(() => createForm.repoId, async (newRepoId) => {
  if (!newRepoId) {
    baseBranches.value = ['main', 'develop']
    return
  }
  const repo = repoList.value.find(r => r.id === newRepoId)
  if (!repo) return
  try {
    const res = await getGiteaBranches(repo.owner, repo.repo)
    const branches = res.data || res
    baseBranches.value = (Array.isArray(branches) ? branches : []).map(b => b.name)
  } catch {
    baseBranches.value = ['main', 'develop']
  }
})

async function handleCreateBranch() {
  if (!createForm.name || !createForm.repoId) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const repo = repoList.value.find(r => r.id === createForm.repoId)
  if (!repo) {
    ElMessage.warning('请选择有效的仓库')
    return
  }
  
  // 参数验证：分支名称不能为空
  if (!createForm.name.trim()) {
    ElMessage.warning('分支名称不能为空')
    return
  }
  
  // 分支名称格式检查：只能包含字母、数字、下划线、连字符、斜杠
  const branchNamePattern = /^[a-zA-Z0-9_\-\/]+$/
  if (!branchNamePattern.test(createForm.name)) {
    ElMessage.warning('分支名称只能包含字母、数字、下划线、连字符和斜杠')
    return
  }
  
  try {
    const { createBranch } = await import('@/api/gitea')
    // Gitea API 参数名：new_branch_name 和 old_branch_name
    await createBranch(repo.owner, repo.repo, {
      new_branch_name: createForm.name.trim(),
      old_branch_name: createForm.baseBranch || 'main'
    })
    ElMessage.success('分支创建成功')
    createDialogVisible.value = false
    loadBranches()
  } catch (error) {
    console.error('创建分支失败:', error)
    // 显示具体的错误信息
    const errorMsg = error?.response?.data?.message || error?.message || '分支创建失败'
    ElMessage.error(`创建失败: ${errorMsg}`)
  }
}

function viewBranch(row) { router.push(`/repos/${row.repoOwner}/${row.repoName}?branch=${row.name}`) }
function createMerge(row) { router.push(`/branches/merge?source=${row.name}&repoOwner=${row.repoOwner}&repoName=${row.repoName}&repoId=${row.repoId}`) }

function deleteBranch(row) {
  ElMessageBox.confirm(`确定要删除分支 "${row.name}" 吗？`, '删除确认', { type: 'warning' })
    .then(() => {
      ElMessage.success('分支已删除')
      loadBranches()
    })
}

function onTrigger(row, event) {
  openMenu(row, event)
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

.action-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
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
}
@media (min-width: 769px) {
  .action-col { width: 240px !important; }
}
</style>
