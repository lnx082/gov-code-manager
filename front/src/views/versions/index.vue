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

    <div class="table-responsive">
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
    </div>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next, jumper"
        @current-change="loadVersions"
      />
    </div>

    <el-dialog v-model="createTagDialogVisible" title="创建版本" width="600px">
      <el-form :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="所属仓库" prop="repoId">
          <el-select v-model="createForm.repoId" placeholder="选择仓库" style="width: 100%" @change="onCreateRepoChange">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.displayName" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="基于分支" prop="targetBranch">
          <el-select v-model="createForm.targetBranch" placeholder="选择分支" style="width: 100%" :disabled="!createForm.repoId">
            <el-option v-for="b in createBranchList" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布标题" prop="title">
          <el-input v-model="createForm.title" placeholder="如：用户模块 v1.0.0 正式发布" style="width: 100%" />
        </el-form-item>
        <el-form-item label="版本号" prop="name">
          <el-input v-model="createForm.name" placeholder="v1.0.0" style="width: 100%" />
          <div class="form-tip">建议遵循语义化版本规范：主版本号.次版本号.修订号</div>
        </el-form-item>
        <el-form-item label="版本说明" prop="message">
          <el-input v-model="createForm.message" type="textarea" :rows="4" placeholder="描述本次版本的主要变更内容" style="width: 100%" />
        </el-form-item>
        <el-form-item label="版本类型">
          <el-radio-group v-model="createForm.type">
            <el-radio label="release"><el-icon><Collection /></el-icon> 正式版本</el-radio>
            <el-radio label="beta"><el-icon><VideoPlay /></el-icon> 测试版本</el-radio>
          </el-radio-group>
        </el-form-item>
        <div class="form-tip" style="margin-left:120px;margin-bottom:12px;color:#909399;font-size:12px">
          提交后将进入默认审批流程（项目管理员审批 → 系统管理员审批）
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createTagDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleCreateTag" :loading="createSubmitting">创建版本</el-button>
      </template>
    </el-dialog>

    <!-- 版本详情对话框 -->
    <el-dialog v-model="versionDialogVisible" :title="'版本 ' + (activeVersion?.name || '')" width="700px">
      <div v-loading="versionDetailLoading">
        <div v-if="!versionDetailLoading && activeVersion" class="version-detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="版本号" :span="2">{{ activeVersion.name }}</el-descriptions-item>
            <el-descriptions-item label="所属仓库">{{ activeVersion.repoOwner }}/{{ activeVersion.repoName }}</el-descriptions-item>
            <el-descriptions-item label="提交 SHA">{{ (activeVersion.sha || '').substring(0, 8) || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交者">{{ activeVersion.committer || activeVersion.tagger || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(activeVersion.created || activeVersion.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="版本说明" :span="2">{{ activeVersion.message || '无' }}</el-descriptions-item>
          </el-descriptions>

          <el-divider v-if="activeVersion.release" content-position="left">Release 信息</el-divider>
          <el-descriptions v-if="activeVersion.release" :column="2" border>
            <el-descriptions-item label="发布名称">{{ activeVersion.release.name || activeVersion.name }}</el-descriptions-item>
            <el-descriptions-item label="发布者">{{ getAuthorName(activeVersion.release.author) }}</el-descriptions-item>
            <el-descriptions-item label="是否预发布">
              <el-tag :type="activeVersion.release.prerelease ? 'warning' : 'success'" size="small">
                {{ activeVersion.release.prerelease ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="发布时间">{{ formatTime(activeVersion.release.created_at) }}</el-descriptions-item>
            <el-descriptions-item v-if="activeVersion.release.body" label="发布说明" :span="2">
              <div class="release-body" v-html="activeVersion.release.body_html || activeVersion.release.body"></div>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <template #footer>
        <el-button @click="versionDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="downloadVersion(activeVersion)"><el-icon><Download /></el-icon> 下载 ZIP</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getTags, getBranches, getReleases, getTag } from '@/api/gitea'
import { getFilteredRepos } from '@/api/bff'
import { createApproval } from '@/api/bff'
import request from '@/api'
import { downloadRepoArchive } from '@/utils/download'
import { Collection, Plus, Search, Refresh, CircleCheck, View, Download, VideoPlay, Link } from '@element-plus/icons-vue'

const loading = ref(false)
const createTagDialogVisible = ref(false)
const createSubmitting = ref(false)
const versionDialogVisible = ref(false)
const versionDetailLoading = ref(false)
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
  type: 'release'
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
    const reposRes = await getFilteredRepos({ page: 1, pageSize: 200 })
    const repos = reposRes.data?.list || reposRes.data || reposRes
    const repoArray = Array.isArray(repos) ? repos : []

    // 构建 repoList，含中文显示名
    repoList.value = repoArray.map(r => {
      const owner = typeof r.owner === 'string' ? r.owner : (r.owner?.login || r.owner?.username || '')
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

    // 并发请求所有仓库的 tags+releases，提升加载速度
    const results = await Promise.allSettled(reposToLoad.map(async (repo) => {
      try {
        if (!repo.owner || !repo.repo) return []
        const [tagRes, releaseRes] = await Promise.all([
          getTags(repo.owner, repo.repo),
          getReleases(repo.owner, repo.repo, { limit: 100 }).catch(() => ({ data: [] }))
        ])
        const tags = tagRes.data || tagRes
        const tagArray = Array.isArray(tags) ? tags : []
        const releases = (releaseRes.data || releaseRes || [])
        const releaseMap = {}
        ;(Array.isArray(releases) ? releases : []).forEach(r => { releaseMap[r.tag_name] = r.prerelease ? 'beta' : 'release' })
        return tagArray.map(t => ({
          ...t, repoOwner: repo.owner, repoName: repo.repo, displayName: repo.displayName,
          name: t.name, message: t.message || '', sha: t.commit?.sha || '',
          type: releaseMap[t.name] || (t.name?.includes('beta') || t.name?.includes('rc') ? 'beta' : 'release'),
        }))
      } catch { return [] }
    }))
    const allTags = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
    // 批量查询基线状态
    if (allTags.length > 0) {
      try {
        const tagKeys = allTags.map(t => `${t.repoOwner}/${t.repoName}@${t.name}`).join(',')
        const baselineRes = await request.get('/baselines/check', { params: { tags: tagKeys } })
        const baselineMap = baselineRes.data || baselineRes || {}
        allTags.forEach(t => {
          const key = `${t.repoOwner}/${t.repoName}@${t.name}`
          t.isBaseline = baselineMap[key] || false
        })
      } catch { /* skip baseline check */ }
    }
    pagination.total = allTags.length
    const start = (pagination.page - 1) * pagination.pageSize
    versionList.value = allTags.slice(start, start + pagination.pageSize)
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

async function viewVersionDetail(row) {
  if (row.repoOwner && row.repoName) {
    activeVersion.value = { ...row }
    versionDialogVisible.value = true
    versionDetailLoading.value = true
    try {
      // 并发获取 tag 详情和 release 列表
      const [tagRes, releaseRes] = await Promise.allSettled([
        getTag(row.repoOwner, row.repoName, row.name),
        getReleases(row.repoOwner, row.repoName, { limit: 100 })
      ])
      if (tagRes.status === 'fulfilled') {
        const tagData = tagRes.value.data || tagRes.value
        if (tagData) {
          activeVersion.value.sha = tagData.commit?.sha || row.sha
          activeVersion.value.message = tagData.message || row.message || ''
          activeVersion.value.committer = tagData.commit?.committer?.name || tagData.commit?.author?.name || ''
          activeVersion.value.tagger = tagData.tagger?.name || ''
          activeVersion.value.created = tagData.commit?.created || tagData.commit?.committer?.date || ''
        }
      }
      if (releaseRes.status === 'fulfilled') {
        const releases = releaseRes.value.data || releaseRes.value || []
        if (Array.isArray(releases)) {
          activeVersion.value.release = releases.find(r => r.tag_name === row.name) || null
        }
      }
    } catch { /* fallback to basic info */ }
    versionDetailLoading.value = false
  } else {
    ElMessage.info(`版本: ${row.name}`)
  }
}
function downloadVersion(row) {
  if (row.repoOwner && row.repoName) {
    downloadRepoArchive(row.repoOwner, row.repoName, row.name, {
      filename: `${row.repoName}-${row.name}.zip`
    })
  } else {
    ElMessage.warning('无法获取仓库信息')
  }
}

function getAuthorName(author) {
  if (!author) return '-'
  
  if (typeof author === 'string') {
    try { 
      const p = JSON.parse(author);
      // 增加一行判断：确保解析出来的 p 真的是个对象
      if (typeof p === 'object' && p !== null) {
        return p.login || p.username || '-';
      }
      // 如果解析出来还是个纯字符串（比如 "besti"），直接返回
      return p;
    } catch { 
      return author; 
    }
  }
  
  return author.login || author.username || '-'
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

.release-body { max-height:300px; overflow-y:auto; padding:8px; background:#fafafa; border-radius:4px; font-size:13px; line-height:1.6; word-break:break-word; }
.release-body :deep(img) { max-width:100%; }
.version-detail { min-height:100px; }
</style>
