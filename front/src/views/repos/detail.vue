<template>
  <div class="repo-detail-container" v-loading="loading">
    <div class="repo-header">
      <div class="repo-info">
        <div class="repo-title">
          <el-icon class="repo-icon"><FolderOpened /></el-icon>
          <h1>{{ repoInfo.name }}</h1>
        </div>
        <p class="repo-description">{{ repoInfo.description || '暂无描述' }}</p>
        <div class="repo-meta">
          <span><el-icon><User /></el-icon> {{ repoInfo.owner }}</span>
          <span><el-icon><Clock /></el-icon> {{ formatTime(repoInfo.updatedAt) }}</span>
        </div>
      </div>
      <div class="repo-actions">
        <el-button type="primary" @click="showCloneDialog"><el-icon><Download /></el-icon> 克隆</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="repo-tabs">
      <!-- 代码浏览 -->
      <el-tab-pane label="代码" name="files">
        <template #label><el-icon><Document /></el-icon> 代码</template>
        <div class="files-container">
          <div class="file-path">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item v-for="(crumb, index) in breadcrumb" :key="index" @click="navigateToPath(crumb.path)" style="cursor:pointer">{{ crumb.name }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="file-list">
            <div class="file-item header">
              <span class="file-name-col">文件名</span><span class="file-message-col">提交信息</span><span class="file-time-col">提交时间</span>
            </div>
            <div v-for="file in fileList" :key="file.path" class="file-item" :class="{ 'is-dir': file.type === 'dir' }" @click="handleFileClick(file)">
              <span class="file-name-col"><el-icon v-if="file.type === 'dir'"><Folder /></el-icon><el-icon v-else><Document /></el-icon><span>{{ file.name }}</span></span>
              <span class="file-message-col">{{ file.lastCommitMessage }}</span>
              <span class="file-time-col">{{ formatTime(file.lastCommitTime) }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 分支 -->
      <el-tab-pane label="分支" name="branches">
        <template #label><el-icon><Share /></el-icon> 分支 ({{ branchList.length }})</template>
        <div class="branch-list">
          <div v-for="b in branchList" :key="b.name" class="branch-item">
            <span>{{ b.name }}</span>
            <el-tag v-if="b.isDefault" size="small" type="danger">默认</el-tag>
            <el-tag v-if="b.isProtected" size="small" type="warning">保护</el-tag>
            <span class="branch-commit">{{ b.commitMessage }}</span>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tag -->
      <el-tab-pane label="版本" name="tags">
        <template #label><el-icon><Collection /></el-icon> 版本 ({{ tagList.length }})</template>
        <div class="tag-list">
          <div v-for="t in tagList" :key="t.name" class="tag-item">
            <el-tag>{{ t.name }}</el-tag>
            <span>{{ t.message }}</span>
            <span class="tag-sha">{{ t.sha?.substring(0, 7) }}</span>
          </div>
        </div>
      </el-tab-pane>

      <!-- 提交历史 -->
      <el-tab-pane label="提交" name="commits">
        <template #label><el-icon><Clock /></el-icon> 提交</template>
        <div class="commits-container">
          <div v-for="commit in commitList" :key="commit.sha" class="commit-item">
            <div class="commit-sha"><el-tag type="info" size="small">{{ commit.sha?.substring(0, 7) }}</el-tag></div>
            <div class="commit-content">
              <div class="commit-message">{{ commit.message }}</div>
              <div class="commit-meta">
                <span class="commit-author">{{ commit.author }}</span>
                <span class="commit-time">{{ formatTime(commit.createdAt) }}</span>
              </div>
            </div>
            <div class="commit-actions">
              <el-button type="primary" link @click="viewCommitDetail(commit)"><el-icon><View /></el-icon> 查看</el-button>
              <el-button type="primary" link @click="viewCommitDiff(commit)"><el-icon><Switch /></el-icon> 差异对比</el-button>
            </div>
          </div>
          <el-pagination v-model:current-page="commitPage" :page-size="20" :total="commitTotal" layout="prev, pager, next" @current-change="loadCommits" />
        </div>
      </el-tab-pane>

      <!-- 合并请求 -->
      <el-tab-pane name="pulls">
        <template #label><el-icon><Connection /></el-icon> 合并请求 ({{ pullList.length }})</template>
        <div class="pull-list" v-loading="pullLoading">
          <div v-if="pullList.length === 0 && !pullLoading" class="empty-state">
            <el-empty description="暂无合并请求" />
          </div>
          <div v-for="pr in pullList" :key="pr.id" class="pull-item">
            <div class="pull-main">
              <div class="pull-title">{{ pr.title }}</div>
              <div class="pull-branches">
                <el-tag size="small">{{ pr.sourceBranch }}</el-tag>
                <el-icon><Right /></el-icon>
                <el-tag size="small" type="primary">{{ pr.targetBranch }}</el-tag>
              </div>
            </div>
            <div class="pull-meta">
              <span class="pull-author"><el-icon><User /></el-icon> {{ pr.author }}</span>
              <span class="pull-time">{{ formatTime(pr.createdAt) }}</span>
              <el-tag :type="pr.state === 'open' ? 'success' : pr.state === 'merged' ? 'primary' : 'info'" size="small">
                {{ pr.state === 'open' ? '开放' : pr.state === 'merged' ? '已合并' : '已关闭' }}
              </el-tag>
            </div>
            <div class="pull-actions">
              <el-button type="primary" link @click="openPullUrl(pr)"><el-icon><Link /></el-icon> 查看</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 成员 -->
      <el-tab-pane name="members">
        <template #label><el-icon><Avatar /></el-icon> 成员 ({{ memberList.length }})</template>
        <div class="member-list" v-loading="memberLoading">
          <div v-if="memberList.length === 0 && !memberLoading" class="empty-state">
            <el-empty description="暂无成员数据" />
          </div>
          <div v-for="member in memberList" :key="member.username || member.login" class="member-item">
            <el-avatar :size="40">{{ (member.username || member.login || 'U').charAt(0).toUpperCase() }}</el-avatar>
            <div class="member-info">
              <div class="member-name">{{ member.username || member.login }}</div>
              <div class="member-role">
                <el-tag :type="member.role === 'admin' || member.role === 'owner' ? 'danger' : member.role === 'write' ? 'warning' : 'info'" size="small">
                  {{ getRoleName(member.role) }}
                </el-tag>
              </div>
            </div>
            <div class="member-contact" v-if="member.email">{{ member.email }}</div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 设置 -->
      <el-tab-pane name="settings">
        <template #label><el-icon><Setting /></el-icon> 设置</template>
        <div class="settings-container">
          <el-card class="settings-card">
            <template #header><span>仓库设置</span></template>
            <el-form :model="settingsForm" label-width="120px" class="settings-form">
              <el-form-item label="仓库名称">
                <el-input v-model="settingsForm.name" placeholder="仓库名称" />
              </el-form-item>
              <el-form-item label="仓库描述">
                <el-input v-model="settingsForm.description" type="textarea" :rows="3" placeholder="仓库描述" />
              </el-form-item>
              <el-form-item label="私有仓库">
                <el-switch v-model="settingsForm.private" />
              </el-form-item>
              <el-form-item label="默认分支">
                <el-input v-model="settingsForm.defaultBranch" placeholder="默认分支" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveSettings" :loading="savingSettings">保存设置</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 克隆对话框 -->
    <el-dialog v-model="cloneDialogVisible" title="克隆仓库" width="500px">
      <p>HTTP: <el-input :model-value="httpCloneUrl" readonly /></p>
      <p>SSH: <el-input :model-value="sshCloneUrl" readonly /></p>
    </el-dialog>

    <!-- 文件内容查看 -->
    <el-dialog v-model="fileContentDialogVisible" :title="viewingFile.name" width="80%" top="5vh">
      <div v-loading="fileContentLoading" style="max-height:70vh;overflow:auto">
        <pre v-if="!fileContentLoading" class="file-content"><code>{{ viewingFile.content }}</code></pre>
      </div>
    </el-dialog>

    <!-- 提交差异对比 -->
    <el-dialog v-model="diffDialogVisible" :title="'提交 ' + diffData.sha?.substring(0, 7)" width="85%" top="5vh">
      <div v-loading="diffLoading">
        <div v-if="!diffLoading">
          <div class="diff-header">
            <p><strong>提交：</strong>{{ diffData.message }}</p>
            <p><strong>作者：</strong>{{ diffData.author }} | {{ diffData.date }}</p>
            <p><strong>变更文件：</strong>{{ diffData.files.length }} 个</p>
          </div>
          <div v-for="file in diffData.files" :key="file.name" class="diff-file">
            <div class="diff-file-header">
              <span class="diff-file-name">{{ file.name }}</span>
              <el-tag :type="file.status === 'added' ? 'success' : file.status === 'removed' ? 'danger' : 'warning'" size="small">{{ file.status === 'added' ? '新增' : file.status === 'removed' ? '删除' : '修改' }}</el-tag>
              <span class="diff-stats"><span style="color:#67c23a">+{{ file.additions }}</span> <span style="color:#f56c6c">-{{ file.deletions }}</span></span>
            </div>
            <div v-if="file.patch" class="diff-patch"><pre><code v-html="renderDiffLines(file.patch)"></code></pre></div>
            <div v-else class="diff-no-patch">无差异详情</div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FolderOpened, Folder, User, Clock, Download, Document, Share, Collection, View, Setting, Connection, Link, Avatar, Right, Switch } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getRepo, getContents, getBranches, getTags, getCommits, getFileContent, compareRepos, getPullRequests, getRepoMembers, updateRepo } from '@/api/gitea'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const activeTab = ref('files')

const repoInfo = reactive({ id: null, name: '', description: '', owner: '', defaultBranch: 'main', updatedAt: '' })
const breadcrumb = ref([{ name: 'root', path: '' }])
const fileList = ref([])
const branchList = ref([])
const tagList = ref([])
const commitList = ref([])
const commitPage = ref(1)
const commitTotal = ref(0)
const currentPath = ref('')

const cloneDialogVisible = ref(false)
const fileContentDialogVisible = ref(false)
const fileContentLoading = ref(false)
const viewingFile = ref({ name: '', path: '', content: '' })

const diffDialogVisible = ref(false)
const diffLoading = ref(false)
const diffData = ref({ sha: '', message: '', author: '', date: '', files: [] })

const pullList = ref([])
const pullLoading = ref(false)
const memberList = ref([])
const memberLoading = ref(false)
const savingSettings = ref(false)

const settingsForm = reactive({
  name: '',
  description: '',
  private: false,
  defaultBranch: 'main'
})

const httpCloneUrl = computed(() => `http://123.60.219.19:3000/${repoInfo.owner}/${repoInfo.name}.git`)
const sshCloneUrl = computed(() => `git@123.60.219.19:${repoInfo.owner}/${repoInfo.name}.git`)

onMounted(() => { loadRepoDetail() })

async function loadRepoDetail() {
  loading.value = true
  try {
    const { owner, name } = route.params
    const res = await getRepo(owner, name)
    const repo = res.data || res
    Object.assign(repoInfo, {
      id: repo.id, name: repo.name, description: repo.description || '',
      owner: repo.owner?.login || repo.owner?.username || '',
      defaultBranch: repo.default_branch || 'main', updatedAt: repo.updated_at
    })
    settingsForm.name = repoInfo.name
    settingsForm.description = repoInfo.description
    settingsForm.private = repo.private || false
    settingsForm.defaultBranch = repoInfo.defaultBranch
  } catch { ElMessage.error('加载仓库信息失败') }
  finally { loading.value = false }
}

watch(activeTab, tab => {
  if (tab === 'files') loadFiles()
  else if (tab === 'branches') loadBranches()
  else if (tab === 'tags') loadTags()
  else if (tab === 'commits') loadCommits()
  else if (tab === 'pulls') loadPulls()
  else if (tab === 'members') loadMembers()
})

async function loadFiles() {
  const { owner, name } = route.params
  const path = currentPath.value || ''
  try {
    const contents = await getContents(owner, name, path)
    const data = contents.data || contents
    fileList.value = (Array.isArray(data) ? data : [data]).map(f => ({
      name: f.name, path: f.path || f.name, type: f.type,
      lastCommitMessage: f.last_commit?.message || '', lastCommitTime: f.last_commit?.timestamp || ''
    }))
  } catch { fileList.value = [] }
}

async function loadBranches() {
  const { owner, name } = route.params
  try {
    const branches = await getBranches(owner, name)
    branchList.value = (branches.data || branches || []).map(b => ({
      name: b.name, isDefault: b.name === repoInfo.defaultBranch, isProtected: b.protected,
      commitMessage: b.commit?.message || '', updatedAt: b.commit?.timestamp || ''
    }))
  } catch { branchList.value = [] }
}

async function loadTags() {
  const { owner, name } = route.params
  try {
    const tags = await getTags(owner, name)
    tagList.value = (tags.data || tags || []).map(t => ({
      name: t.name, message: t.message || '', sha: t.commit?.sha || '', createdAt: t.commit?.created || ''
    }))
  } catch { tagList.value = [] }
}

function loadCommits() {
  loadCommitsData()
}
async function loadCommitsData() {
  const { owner, name } = route.params
  try {
    const commits = await getCommits(owner, name, { page: commitPage.value, limit: 20 })
    commitList.value = (commits.data || commits || []).map(c => ({
      sha: c.sha, message: c.commit?.message || c.message || '',
      author: c.author?.login || c.commit?.author?.name || '',
      createdAt: c.commit?.author?.date || '',
      parentSha: c.parents?.[0]?.sha || ''
    }))
    commitTotal.value = commitList.value.length
  } catch { commitList.value = [] }
}

function handleFileClick(file) {
  if (file.type === 'dir') { currentPath.value = file.path; updateBreadcrumb(file.path); loadFiles() }
  else viewFileContent(file)
}
function navigateToPath(path) { currentPath.value = path || ''; updateBreadcrumb(path || ''); loadFiles() }
function updateBreadcrumb(path) {
  const parts = (path || '').split('/').filter(Boolean)
  const crumbs = [{ name: repoInfo.name || 'root', path: '' }]
  let acc = ''; parts.forEach(p => { acc += (acc ? '/' : '') + p; crumbs.push({ name: p, path: acc }) })
  breadcrumb.value = crumbs
}

async function viewFileContent(file) {
  const { owner, name } = route.params
  viewingFile.value = { name: file.name, path: file.path, content: '' }
  fileContentDialogVisible.value = true; fileContentLoading.value = true
  try {
    const res = await getFileContent(owner, name, file.path)
    viewingFile.value.content = typeof res.data === 'string' ? res.data : (res.data || res)
  } catch { viewingFile.value.content = '// 无法加载文件内容' }
  finally { fileContentLoading.value = false }
}

async function viewCommitDiff(commit) {
  const { owner, name } = route.params
  diffData.value = { sha: commit.sha, message: commit.message, author: commit.author, date: commit.createdAt, files: [] }
  diffDialogVisible.value = true; diffLoading.value = true
  try {
    // 使用 Gitea git/commits API（返回 files + stats）
    const commitRes = await getCommit(owner, name, commit.sha)
    const detail = commitRes.data || commitRes
    const files = detail.files || detail.stats || []
    diffData.value.files = (Array.isArray(files) ? files : []).map(f => ({
      name: f.filename || f.name || '',
      status: f.status || 'modified',
      additions: f.additions || 0,
      deletions: f.deletions || 0,
      patch: f.patch || ''
    }))
  } catch (e) { console.error('加载差异失败:', e) }
  finally { diffLoading.value = false }
}

function viewCommitDetail(commit) {
  const { owner, name } = route.params
  window.open(`http://123.60.219.19:3000/${owner}/${name}/commit/${commit.sha}`, '_blank')
}

function renderDiffLines(patch) {
  if (!patch) return ''
  return patch.split('\n').map(line => {
    const e = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    if (line.startsWith('+') && !line.startsWith('+++')) return `<span class="diff-add">${e}</span>`
    if (line.startsWith('-') && !line.startsWith('---')) return `<span class="diff-del">${e}</span>`
    if (line.startsWith('@@')) return `<span class="diff-hunk">${e}</span>`
    return e
  }).join('\n')
}

async function loadPulls() {
  const { owner, name } = route.params
  pullLoading.value = true
  try {
    const res = await getPullRequests(owner, name, { state: 'all', page: 1, limit: 50 })
    const prs = res.data || res
    pullList.value = (Array.isArray(prs) ? prs : []).map(pr => ({
      id: pr.id || pr.number,
      title: pr.title,
      sourceBranch: pr.head?.label || pr.head?.ref || '',
      targetBranch: pr.base?.label || pr.base?.ref || '',
      state: pr.state === 'open' ? 'open' : (pr.merged ? 'merged' : 'closed'),
      author: pr.user?.username || pr.user?.login || '',
      createdAt: pr.created_at || '',
      url: pr.html_url || `http://123.60.219.19:3000/${owner}/${name}/pulls/${pr.number || pr.id}`
    }))
  } catch { pullList.value = [] }
  finally { pullLoading.value = false }
}

async function loadMembers() {
  const { owner, name } = route.params
  memberLoading.value = true
  try {
    const res = await getRepoMembers(owner, name)
    const data = res.data || res
    memberList.value = (Array.isArray(data) ? data : []).map(m => ({
      username: m.username || m.login || m.name || '',
      login: m.login || m.username || '',
      email: m.email || '',
      role: m.permissions?.admin ? 'admin' : m.permissions?.push ? 'write' : 'read',
      avatarUrl: m.avatar_url || m.avatarUrl || ''
    }))
  } catch { memberList.value = [] }
  finally { memberLoading.value = false }
}

function openPullUrl(pr) {
  if (pr.url) {
    window.open(pr.url, '_blank')
  }
}

async function saveSettings() {
  const { owner, name } = route.params
  savingSettings.value = true
  try {
    await updateRepo(owner, name, {
      name: settingsForm.name,
      description: settingsForm.description,
      private: settingsForm.private,
      default_branch: settingsForm.defaultBranch
    })
    ElMessage.success('仓库设置已保存')
    loadRepoDetail()
  } catch (e) {
    ElMessage.warning('仓库设置保存失败')
  }
  finally { savingSettings.value = false }
}

function getRoleName(role) {
  const map = { 'admin': '管理员', 'owner': '所有者', 'write': '写入', 'read': '只读', 'push': '推送' }
  return map[role] || role || '成员'
}

function formatTime(time) { if (!time) return '-'; return new Date(time).toLocaleString('zh-CN') }
function showCloneDialog() { cloneDialogVisible.value = true }
</script>

<style lang="scss" scoped>
.repo-detail-container { background:#fff; border-radius:8px; padding:0; overflow:hidden; }
.repo-header { display:flex; justify-content:space-between; align-items:flex-start; padding:24px; border-bottom:1px solid #ebeef5; background:#fafafa; }
.repo-title { display:flex; align-items:center; gap:8px; h1 { margin:0; font-size:22px; } }
.repo-description { color:#909399; margin:8px 0; }
.repo-meta { display:flex; gap:16px; color:#909399; font-size:13px; span { display:flex; align-items:center; gap:4px; } }
.repo-actions { display:flex; gap:8px; flex-shrink:0; }
.repo-tabs { padding:0 24px; }
.files-container { padding:12px 0; }
.file-path { margin-bottom:12px; }
.file-list { border:1px solid #ebeef5; border-radius:4px; }
.file-item { display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid #ebeef5; cursor:pointer; &:hover { background:#f5f7fa; } &.header { font-weight:bold; background:#fafafa; cursor:default; } &.is-dir { .file-name-col { color:#409eff; font-weight:bold; } } }
.file-name-col { flex:1; display:flex; align-items:center; gap:6px; }
.file-message-col { flex:1; color:#909399; font-size:13px; }
.file-time-col { width:180px; color:#c0c4cc; font-size:13px; }
.branch-list, .tag-list { padding:12px 0; }
.branch-item, .tag-item { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #ebeef5; }
.branch-commit { color:#909399; font-size:13px; margin-left:auto; }
.tag-sha { color:#c0c4cc; font-size:12px; margin-left:auto; }
.commits-container { padding:12px 0; }
.commit-item { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #ebeef5; }
.commit-sha { flex-shrink:0; }
.commit-content { flex:1; }
.commit-message { font-weight:bold; }
.commit-meta { color:#909399; font-size:12px; display:flex; gap:12px; }
.commit-actions { display:flex; gap:4px; flex-shrink:0; }
.file-content { background:#1e1e1e; color:#d4d4d4; padding:16px; border-radius:4px; font-size:13px; line-height:1.5; overflow:auto; max-height:65vh; white-space:pre-wrap; word-break:break-all; }
.diff-header { margin-bottom:16px; padding:12px; background:#f5f7fa; border-radius:4px; p { margin:4px 0; } }
.diff-file { margin-bottom:20px; border:1px solid #e4e7ed; border-radius:4px; overflow:hidden; }
.diff-file-header { padding:8px 12px; background:#f5f7fa; display:flex; align-items:center; gap:8px; border-bottom:1px solid #e4e7ed; }
.diff-file-name { font-weight:bold; flex:1; }
.diff-patch { background:#1e1e1e; color:#ccc; padding:12px; overflow:auto; max-height:300px; font-family:Consolas,'Courier New',monospace; font-size:12px; line-height:1.4; pre { margin:0; white-space:pre; } }
.diff-no-patch { padding:16px; text-align:center; color:#999; }
.diff-add { background:#1b3a1b; display:block; }
.diff-del { background:#3a1b1b; display:block; }
.diff-hunk { color:#569cd6; display:block; }
.diff-stats { font-size:12px; }

/* Pull requests */
.pull-list { padding:12px 0; }
.pull-item { display:flex; align-items:center; justify-content:space-between; padding:12px; border-bottom:1px solid #ebeef5; transition:background 0.2s; &:hover { background:#fafafa; } }
.pull-main { flex:1; .pull-title { font-weight:bold; color:#303133; margin-bottom:4px; } .pull-branches { display:flex; align-items:center; gap:6px; font-size:13px; } }
.pull-meta { display:flex; align-items:center; gap:12px; color:#909399; font-size:13px; span { display:flex; align-items:center; gap:4px; } }
.pull-actions { flex-shrink:0; margin-left:12px; }

/* Members */
.member-list { padding:12px 0; }
.member-item { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #ebeef5; }
.member-info { flex:1; .member-name { font-weight:500; color:#303133; } .member-role { margin-top:2px; } }
.member-contact { color:#909399; font-size:13px; }

/* Settings */
.settings-container { padding:12px 0; }
.settings-card { max-width:600px; }
.settings-form { padding:12px 0; }
</style>
