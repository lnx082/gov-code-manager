<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title"><el-icon><Folder /></el-icon> 仓库列表</h2>
      <div class="button-group">
        <el-button type="primary" @click="$router.push('/repos/create')" v-if="canCreateRepo">
          <el-icon><Plus /></el-icon> 创建仓库
        </el-button>
        <el-button @click="loadRepos">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
    </div>

    <!-- 搜索区域 -->
    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="仓库名称">
          <el-input v-model="searchForm.name" placeholder="搜索仓库名称" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="保密等级">
          <el-select v-model="searchForm.secretLevel" placeholder="选择等级" clearable style="width: 150px">
            <el-option label="公开" value="public" />
            <el-option label="秘密" value="secret" />
            <el-option label="机密" value="confidential" />
            <el-option label="绝密" value="top-secret" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 仓库列表 -->
    <div class="table-responsive">
      <el-table :data="repoList" v-loading="loading" stripe border @row-contextmenu.prevent="openMenu">
      <el-table-column type="selection" width="50" />
      <el-table-column prop="name" label="仓库名称" min-width="180">
        <template #default="{ row }">
          <div class="repo-name-cell" @click="viewRepo(row)">
            <el-icon class="repo-icon"><Folder /></el-icon>
            <span class="repo-name">{{ row.displayName || row.full_name || row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="主管部门" width="120" class="col-hide-mobile">
        <template #default="{ row }">
          {{ row.department || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="保密等级" width="100" align="center" class="col-hide-mobile">
        <template #default="{ row }">
          <el-tag :type="getSecretLevelTagType(row.secretLevel)" size="small">
            {{ getSecretLevelName(row.secretLevel) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分支" width="80" align="center" class="col-hide-mobile">
        <template #default="{ row }">
          <el-tag type="info" size="small">{{ row.branches_count || 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Stars" width="80" align="center" class="col-hide-mobile">
        <template #default="{ row }">
          <span>{{ row.stars_count || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="160" class="col-hide-mobile">
        <template #default="{ row }">
          {{ formatTime(row.updated_at || row.updated) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="viewRepo(row)">查看</el-button>
            <el-button type="primary" link @click="cloneRepo(row)">克隆</el-button>
            <el-button
              v-if="userStore.hasPermission('admin:manage')"
              type="danger" link
              @click="handleDeleteRepo(row)"
            >删除</el-button>
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
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadRepos"
        @current-change="loadRepos"
      />
    </div>

    <!-- 克隆对话框 -->
    <el-dialog v-model="cloneDialogVisible" title="克隆仓库" width="500px">
      <div class="clone-content">
        <el-form label-width="100px">
          <el-form-item label="仓库名称">
            <span>{{ cloneInfo.name }}</span>
          </el-form-item>
          <el-form-item label="仓库地址">
            <el-input v-model="cloneInfo.httpUrl" readonly />
          </el-form-item>
        </el-form>
        <div class="clone-commands">
          <p>克隆命令：</p>
          <div class="code-block">
            <pre>git clone {{ cloneInfo.httpUrl }}</pre>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="copyUrl(cloneInfo.httpUrl)">复制地址</el-button>
        <el-button type="primary" @click="cloneDialogVisible = false">关闭</el-button>
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
import { ref, reactive, onMounted, computed } from 'vue'
import { Folder, Plus, Refresh, MoreFilled, View, Download, Delete } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getFilteredRepos } from '@/api/bff'
import { deleteRepo } from '@/api/gitea'
import { GITEA_URL, GITEA_SSH_HOST } from '@/config'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'

const router = useRouter()
const userStore = useUserStore()
const canCreateRepo = computed(() => {
  const role = userStore.userInfo?.role || ''
  return role === 'admin' || role === 'project_manager'
})
const loading = ref(false)
const repoList = ref([])
const cloneDialogVisible = ref(false)
const cloneInfo = reactive({
  name: '',
  httpUrl: '',
  sshUrl: ''
})

const searchForm = reactive({
  name: '',
  secretLevel: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '查看', icon: View, onClick: () => viewRepo(row) },
    { label: '克隆', icon: Download, onClick: () => cloneRepo(row) },
    { label: '删除', icon: Delete, type: 'danger', divided: true, visible: userStore.hasPermission('admin:manage'), onClick: () => handleDeleteRepo(row) },
  ]
}

onMounted(() => {
  loadRepos()
})

async function loadRepos() {
  loading.value = true
  try {
    // 从 BFF 获取已过滤的仓库列表（后端处理部门隔离 + 密级管控）
    const res = await getFilteredRepos({ page: 1, pageSize: 200 })
    const data = res.data || res
    let repos = data.list || data || []
    if (!Array.isArray(repos)) repos = []

    // 解析显示名和密级
    function parseDisplayName(desc) {
      if (!desc) return null
      const match = desc.match(/\[显示名=([^\]]+)\]/)
      return match ? match[1] : null
    }

    // 映射为前端显示格式
    let mapped = repos.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name || r.name,
      displayName: parseDisplayName(r.description) || r.full_name || r.name,
      description: r.description || '',
      private: r.private,
      owner: r.owner || '',
      department: r._department_name || '-',
      secretLevel: r._secret_level || 'secret',
      branches_count: r.branches_count || 0,
      stars_count: r.stars_count || 0,
      updated_at: r.updated_at,
    }))

    // 客户端名称搜索
    if (searchForm.name) {
      const q = searchForm.name.toLowerCase()
      mapped = mapped.filter(r =>
        r.displayName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      )
    }

    // 客户端密级二次筛选
    if (searchForm.secretLevel) {
      mapped = mapped.filter(r => r.secretLevel === searchForm.secretLevel)
    }

    // 客户端分页
    pagination.total = mapped.length
    const start = (pagination.page - 1) * pagination.pageSize
    repoList.value = mapped.slice(start, start + pagination.pageSize)
  } catch (error) {
    console.error('获取仓库列表失败:', error)
    ElMessage.warning('加载仓库列表失败，请重新登录')
    repoList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadRepos()
}

function resetSearch() {
  searchForm.name = ''
  searchForm.secretLevel = ''
  handleSearch()
}

function viewRepo(row) {
  const owner = row.owner || ''
  const name = row.name || ''
  router.push(`/repos/${owner}/${name}`)
}

function cloneRepo(row) {
  cloneInfo.name = row.name
  cloneInfo.httpUrl = `${GITEA_URL}/${row.owner || 'root'}/${row.name}.git`
  cloneInfo.sshUrl = `git@${GITEA_SSH_HOST}:${row.owner || 'root'}/${row.name}.git`
  cloneDialogVisible.value = true
}

function copyUrl(url) {
  navigator.clipboard.writeText(url)
  ElMessage.success('已复制到剪贴板')
}

async function handleDeleteRepo(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除仓库 "${row.displayName}" 吗？\n此操作不可恢复！`,
      '删除仓库',
      { type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
    const owner = row.owner || 'root'
    await deleteRepo(owner, row.name)
    ElMessage.success('仓库已删除')
    loadRepos()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.response?.data?.message || '删除失败')
    }
  }
}

function getSecretLevelTagType(level) {
  const map = { public: '', secret: 'warning', confidential: 'danger', 'top-secret': 'danger' }
  return map[level] || 'info'
}

function getSecretLevelName(level) {
  const map = { public: '公开', secret: '秘密', confidential: '机密', 'top-secret': '绝密' }
  return map[level] || level || '未知'
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
.repo-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  
  .repo-icon {
    font-size: 18px;
  }
  
  .repo-name {
    color: #409eff;
    font-weight: 500;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.clone-commands {
  margin-top: 15px;
  
  p {
    color: #606266;
    margin-bottom: 10px;
  }
}

.code-block {
  background: #282c34;
  border-radius: 6px;
  padding: 12px;

  pre {
    margin: 0;
    color: #abb2bf;
    font-family: 'Monaco', monospace;
    font-size: 13px;
  }
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
