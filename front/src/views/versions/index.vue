<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title"><el-icon><Collection /></el-icon> 版本列表</h2>
      <div class="button-group">
        <el-button type="danger" @click="showCreateTag"><el-icon><Plus /></el-icon> 创建版本</el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="仓库">
          <el-select v-model="filterForm.repoId" placeholder="选择仓库" clearable style="width: 240px">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.displayName" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本类型">
          <el-select v-model="filterForm.type" clearable style="width: 150px">
            <el-option label="正式版本" value="release" />
            <el-option label="测试版本" value="beta" />
          </el-select>
        </el-form-item>
        <el-form-item label="保密等级">
          <el-select v-model="filterForm.secretLevel" clearable style="width: 150px">
            <el-option label="公开" value="public" />
            <el-option label="内部" value="internal" />
            <el-option label="涉密" value="secret" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="danger" @click="handleFilter"><el-icon><Search /></el-icon> 筛选</el-button>
          <el-button @click="resetFilter"><el-icon><Refresh /></el-icon> 重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="versionList" v-loading="loading" stripe border>
      <el-table-column label="版本号" width="150">
        <template #default="{ row }">
          <div class="version-cell">
            <el-icon><Collection /></el-icon>
            <span class="version-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="版本说明" min-width="200" show-overflow-tooltip />
      <el-table-column label="所属仓库" width="180">
        <template #default="{ row }">
          {{ row.displayName || row.repoName }}
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'release' ? 'success' : 'warning'" size="small">
            {{ row.type === 'release' ? '正式' : '测试' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否基线" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.isBaseline" type="success" size="small"><el-icon><CircleCheck /></el-icon> 基线</el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="创建者" width="100" />
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewVersionDetail(row)"><el-icon><View /></el-icon> 详情</el-button>
          <el-button type="primary" link @click="downloadVersion(row)"><el-icon><Download /></el-icon> 下载</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadVersions"
      />
    </div>

    <el-dialog v-model="createTagDialogVisible" title="创建版本" width="600px">
      <el-form :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="所属仓库" prop="repoId" class="form-required">
          <el-select v-model="createForm.repoId" placeholder="选择仓库" style="width: 100%" @change="onCreateRepoChange">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.displayName" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="基于分支" prop="targetBranch" class="form-required">
          <el-select v-model="createForm.targetBranch" placeholder="选择分支" style="width: 100%" :disabled="!createForm.repoId">
            <el-option v-for="b in createBranchList" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布标题" prop="title">
          <el-input v-model="createForm.title" placeholder="如：用户模块 v1.0.0 正式发布" />
        </el-form-item>
        <el-form-item label="版本号" prop="name" class="form-required">
          <el-input v-model="createForm.name" placeholder="v1.0.0" />
          <div class="form-tip">建议遵循语义化版本规范：主版本号.次版本号.修订号</div>
        </el-form-item>
        <el-form-item label="版本说明" prop="message" class="form-required">
          <el-input v-model="createForm.message" type="textarea" :rows="4" placeholder="描述本次版本的主要变更内容" />
        </el-form-item>
        <el-form-item label="版本类型">
          <el-radio-group v-model="createForm.type">
            <el-radio label="release"><el-icon><Collection /></el-icon> 正式版本</el-radio>
            <el-radio label="beta"><el-icon><VideoPlay /></el-icon> 测试版本</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关联审批">
          <el-switch v-model="createForm.requireApproval" />
          <span class="switch-tip">提交后将进入默认审批流程（项目管理员审批 → 系统管理员审批）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createTagDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleCreateTag" :loading="createSubmitting">创建版本</el-button>
      </template>
    </el-dialog>

    <!-- 版本详情对话框 -->
    <el-dialog v-model="versionDialogVisible" :title="'版本 ' + (activeVersion?.name || '')" width="600px">
      <div v-if="activeVersion" class="version-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="版本号">{{ activeVersion.name }}</el-descriptions-item>
          <el-descriptions-item label="所属仓库">{{ activeVersion.repoOwner }}/{{ activeVersion.repoName }}</el-descriptions-item>
          <el-descriptions-item label="提交 SHA">{{ activeVersion.sha?.substring(0, 8) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="版本说明">{{ activeVersion.message || '无' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px;display:flex;gap:8px">
          <el-button type="primary" @click="downloadVersion(activeVersion)"><el-icon><Download /></el-icon> 下载 ZIP</el-button>
          <el-button @click="openGiteaRelease(activeVersion)"><el-icon><Link /></el-icon> Gitea 页面</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getTags, getMyRepos, getBranches } from '@/api/gitea'
import { createApproval } from '@/api/bff'
import { Collection, Plus, Search, Refresh, CircleCheck, View, Download, VideoPlay, Link } from '@element-plus/icons-vue'

const loading = ref(false)
const createTagDialogVisible = ref(false)
const createSubmitting = ref(false)
const versionDialogVisible = ref(false)
const activeVersion = ref(null)

const filterForm = reactive({ repoId: '', type: '', secretLevel: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const versionList = ref([])
const repoList = ref([])
const createBranchList = ref([])

// 解析中文显示名
function parseDisplayName(desc, fallback) {
  if (!desc) return fallback || ''
  const m = desc.match(/\[显示名=([^\]]+)\]/)
  return m ? m[1] : (fallback || '')
}

const createForm = reactive({
  repoId: '',
  targetBranch: '',
  title: '',
  name: '',
  message: '',
  type: 'release',
  requireApproval: true
})

const createRules = {
  repoId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  targetBranch: [{ required: true, message: '请选择基于分支', trigger: 'change' }],
  name: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
  message: [{ required: true, message: '请输入版本说明', trigger: 'blur' }]
}

onMounted(() => { loadVersions() })

// 创建表单仓库变化时，加载该仓库的分支列表
async function onCreateRepoChange(repoId) {
  createForm.targetBranch = ''
  createBranchList.value = []
  if (!repoId) return
  const repo = repoList.value.find(r => r.id === repoId)
  if (!repo) return
  try {
    const res = await getBranches(repo.owner, repo.repo)
    const branches = res.data || res
    createBranchList.value = (Array.isArray(branches) ? branches : []).map(b => b.name)
    // 默认选中默认分支
    const defaultBranch = createBranchList.value.find(b => b === 'main' || b === 'master')
    if (defaultBranch) createForm.targetBranch = defaultBranch
  } catch {
    createBranchList.value = ['main']
    createForm.targetBranch = 'main'
  }
}

async function loadVersions() {
  loading.value = true
  try {
    const reposRes = await getMyRepos({ page: 1, limit: 100 })
    const repos = reposRes.data || reposRes
    const repoArray = Array.isArray(repos) ? repos : []

    // 构建 repoList，含中文显示名
    repoList.value = repoArray.map(r => {
      const owner = r.owner?.login || r.owner?.username || ''
      const name = r.name
      return {
        id: r.id,
        name: r.full_name || r.name,
        displayName: parseDisplayName(r.description, r.full_name || r.name),
        owner,
        repo: name,
        repoOwner: owner,
        repoName: name
      }
    })

    // 如果筛选了仓库，只加载该仓库的 tags
    const reposToLoad = filterForm.repoId
      ? repoList.value.filter(r => r.id === filterForm.repoId)
      : repoList.value

    const allTags = []
    for (const repo of reposToLoad) {
      try {
        if (!repo.owner || !repo.repo) continue
        const tagRes = await getTags(repo.owner, repo.repo)
        const tags = tagRes.data || tagRes
        const tagArray = Array.isArray(tags) ? tags : []
        tagArray.forEach(t => allTags.push({
          ...t,
          repoOwner: repo.owner,
          repoName: repo.repo,
          displayName: repo.displayName,
          name: t.name,
          message: t.message || '',
          sha: t.commit?.sha || '',
        }))
      } catch { /* skip failed repos */ }
    }
    versionList.value = allTags
    pagination.total = allTags.length
  } catch {
    ElMessage.warning('加载版本列表失败')
  } finally {
    loading.value = false
  }
}

function handleFilter() { loadVersions() }
function resetFilter() {
  filterForm.repoId = ''
  filterForm.type = ''
  filterForm.secretLevel = ''
  loadVersions()
}

async function showCreateTag() {
  createForm.repoId = ''
  createForm.targetBranch = ''
  createForm.title = ''
  createForm.name = ''
  createForm.message = ''
  createForm.type = 'release'
  createForm.requireApproval = true
  createBranchList.value = []
  createTagDialogVisible.value = true
}

async function handleCreateTag() {
  if (!createForm.repoId || !createForm.name || !createForm.message || !createForm.targetBranch) {
    ElMessage.warning('请填写必填项')
    return
  }
  const repo = repoList.value.find(r => r.id === createForm.repoId)
  if (!repo) {
    ElMessage.warning('请选择有效的仓库')
    return
  }
  createSubmitting.value = true
  try {
    // 提交审批申请（自动使用默认审批流程），审批通过后由 BFF 执行 tag/release
    await createApproval({
      operationType: 'version_release',
      title: createForm.title || `${repo.displayName} ${createForm.name}`,
      description: createForm.message,
      repoOwner: repo.owner,
      repoName: repo.repo,
      targetBranch: createForm.targetBranch,
      body: JSON.stringify({
        repoOwner: repo.owner,
        repoName: repo.repo,
        tagName: createForm.name.trim(),
        releaseTitle: createForm.title || createForm.name.trim(),
        releaseBody: createForm.message.trim(),
        targetBranch: createForm.targetBranch,
        prerelease: createForm.type !== 'release'
      })
    })
    ElMessage.success('版本发布申请已提交，等待审批通过后将自动发布')
    createTagDialogVisible.value = false
    loadVersions()
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || '未知错误'
    ElMessage.error('提交审批失败：' + msg)
  } finally {
    createSubmitting.value = false
  }
}

function viewVersionDetail(row) {
  if (row.repoOwner && row.repoName) {
    activeVersion.value = row
    versionDialogVisible.value = true
  } else {
    ElMessage.info(`版本: ${row.name}`)
  }
}
function openGiteaRelease(row) {
  if (row.repoOwner && row.repoName) {
    window.open(`http://123.60.219.19:3000/${row.repoOwner}/${row.repoName}/releases/tag/${row.name}`, '_blank')
  }
}
function downloadVersion(row) {
  if (row.repoOwner && row.repoName) {
    const a = document.createElement('a')
    a.href = `http://123.60.219.19:3000/${row.repoOwner}/${row.repoName}/archive/${row.name}.zip`
    a.download = `${row.repoName}-${row.name}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } else {
    ElMessage.warning('无法获取仓库信息')
  }
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.version-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .version-name {
    color: #c41230;
    font-weight: 600;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.switch-tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}
</style>
