<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">📁 仓库列表</h2>
      <div class="button-group">
        <el-button type="primary" @click="$router.push('/repos/create')">
          <span>➕</span> 创建仓库
        </el-button>
        <el-button @click="loadRepos">
          <span>🔄</span> 刷新
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
            <el-option label="内部" value="internal" />
            <el-option label="涉密" value="secret" />
            <el-option label="机密" value="top-secret" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 仓库列表 -->
    <el-table :data="repoList" v-loading="loading" stripe border>
      <el-table-column type="selection" width="50" />
      <el-table-column prop="name" label="仓库名称" min-width="180">
        <template #default="{ row }">
          <div class="repo-name-cell" @click="viewRepo(row)">
            <span class="repo-icon">📁</span>
            <span class="repo-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.private ? 'warning' : 'success'" size="small">
            {{ row.private ? '私有' : '公开' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分支" width="80" align="center">
        <template #default="{ row }">
          <el-tag type="info" size="small">{{ row.branches_count || 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Stars" width="80" align="center">
        <template #default="{ row }">
          <span>{{ row.stars_count || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.updated_at || row.updated) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewRepo(row)">查看</el-button>
          <el-button type="primary" link @click="cloneRepo(row)">克隆</el-button>
        </template>
      </el-table-column>
    </el-table>

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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getRepoList } from '@/api/repo'

const router = useRouter()
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

onMounted(() => {
  loadRepos()
})

async function loadRepos() {
  loading.value = true
  try {
    const res = await getRepoList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: searchForm.name || undefined
    })
    repoList.value = res.data?.list || res.data || []
    pagination.total = res.data?.total || repoList.value.length
  } catch (error) {
    console.error('获取仓库列表失败:', error)
    // 使用模拟数据
    repoList.value = [
      { id: 1, name: 'gov-user-service', description: '政务系统用户服务模块', private: true, branches_count: 5, stars_count: 12, updated_at: '2024-01-15T10:00:00Z' },
      { id: 2, name: 'gov-auth-module', description: '统一认证模块', private: true, branches_count: 3, stars_count: 8, updated_at: '2024-01-14T15:30:00Z' },
      { id: 3, name: 'gov-documentation', description: '项目文档', private: false, branches_count: 2, stars_count: 25, updated_at: '2024-01-13T09:00:00Z' }
    ]
    pagination.total = repoList.value.length
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
  router.push(`/repos/${row.id}`)
}

function cloneRepo(row) {
  cloneInfo.name = row.name
  cloneInfo.httpUrl = `http://123.60.219.19:3000/${row.owner || 'root'}/${row.name}.git`
  cloneInfo.sshUrl = `git@123.60.219.19:${row.owner || 'root'}/${row.name}.git`
  cloneDialogVisible.value = true
}

function copyUrl(url) {
  navigator.clipboard.writeText(url)
  ElMessage.success('已复制到剪贴板')
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
</style>
