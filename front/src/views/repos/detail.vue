<template>
  <div class="repo-detail-container" v-loading="loading">
    <div class="repo-header">
      <div class="repo-info">
        <div class="repo-title">
          <el-icon class="repo-icon"><FolderOpened /></el-icon>
          <h1>{{ displayName }}</h1>
          <el-tag v-if="repoType" :type="repoTypeTag" size="small">{{ repoTypeLabel }}</el-tag>
        </div>
        <p class="repo-subname" v-if="displayName !== repoInfo.name">{{ repoInfo.name }}</p>
        <p class="repo-description">{{ cleanDescription || '暂无描述' }}</p>
        <div class="repo-meta">
          <span><el-icon><User /></el-icon> {{ repoInfo.owner }}</span>
          <span><el-icon><Clock /></el-icon> {{ formatTime(repoInfo.updatedAt) }}</span>
        </div>
      </div>
      <div class="repo-actions">
        <el-button @click="downloadZip"><el-icon><Download /></el-icon> 下载 ZIP</el-button>
        <el-button type="primary" @click="showCloneDialog"><el-icon><Download /></el-icon> 克隆</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="repo-tabs" @tab-change="onTabChange">
      <el-tab-pane name="files"><template #label><el-icon><Document /></el-icon> 代码</template>
        <div class="files-container">
          <div class="file-path">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item v-for="(c,i) in breadcrumb" :key="i" @click="navigateToPath(c.path)" style="cursor:pointer">{{ c.name }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="file-list">
            <div class="file-item header"><span class="file-name-col">文件名</span><span class="file-message-col">提交信息</span><span class="file-time-col">提交时间</span></div>
            <div v-for="f in fileList" :key="f.path" class="file-item" :class="{'is-dir':f.type==='dir'}" @click="handleFileClick(f)">
              <span class="file-name-col"><el-icon v-if="f.type==='dir'"><Folder /></el-icon><el-icon v-else><Document /></el-icon><span>{{ f.name }}</span></span>
              <span class="file-message-col">{{ f.lastCommitMessage }}</span>
              <span class="file-time-col">{{ formatTime(f.lastCommitTime) }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="branches"><template #label><el-icon><Share /></el-icon> 分支 ({{ branchList.length }})</template>
        <div class="branch-list">
          <div v-for="b in branchList" :key="b.name" class="branch-item" style="cursor:pointer" @click="viewBranch(b)">
            <span>{{ b.name }}</span>
            <el-tag v-if="b.isDefault" size="small" type="danger">默认</el-tag>
            <el-tag v-if="b.isProtected" size="small" type="warning">保护</el-tag>
            <span class="branch-commit">{{ b.commitMessage }}</span>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="tags"><template #label><el-icon><Collection /></el-icon> 版本 ({{ tagList.length }})</template>
        <div class="tag-list">
          <div v-for="t in tagList" :key="t.name" class="tag-item" style="cursor:pointer" @click="viewTag(t)">
            <el-tag>{{ t.name }}</el-tag><span>{{ t.message }}</span><span class="tag-sha">{{ t.sha?.substring(0,7) }}</span>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="commits"><template #label><el-icon><Clock /></el-icon> 提交</template>
        <div class="commits-container">
          <div v-for="c in commitList" :key="c.sha" class="commit-item">
            <div class="commit-sha"><el-tag type="info" size="small">{{ c.sha?.substring(0,7) }}</el-tag></div>
            <div class="commit-content"><div class="commit-message">{{ c.message }}</div><div class="commit-meta"><span>{{ c.author }}</span><span>{{ formatTime(c.createdAt) }}</span></div></div>
            <div class="commit-actions">
              <el-button type="primary" link @click="viewCommitDetail(c)"><el-icon><View /></el-icon> 查看</el-button>
              <el-button type="primary" link @click="viewCommitDiff(c)">差异对比</el-button>
            </div>
          </div>
          <el-pagination v-model:current-page="commitPage" :page-size="20" :total="commitTotal" layout="prev,pager,next" @current-change="loadCommits" />
        </div>
      </el-tab-pane>

      <el-tab-pane name="pulls"><template #label><el-icon><Connection /></el-icon> 合并请求 ({{ pullList.length }})</template>
        <div class="pull-list" v-loading="pullLoading">
          <div v-for="pr in pullList" :key="pr.id" class="pull-item">
            <div class="pull-main"><div class="pull-title">{{ pr.title }}</div><div class="pull-branches"><el-tag size="small">{{ pr.sourceBranch }}</el-tag><el-icon><Right /></el-icon><el-tag size="small" type="primary">{{ pr.targetBranch }}</el-tag></div></div>
            <div class="pull-meta"><span>{{ pr.author }}</span><span>{{ formatTime(pr.createdAt) }}</span><el-tag :type="pr.state==='open'?'success':pr.state==='merged'?'primary':'info'" size="small">{{ pr.state==='open'?'开放':pr.state==='merged'?'已合并':'已关闭' }}</el-tag></div>
            <div class="pull-actions"><el-button type="primary" link @click="openPullUrl(pr)"><el-icon><Link /></el-icon> 查看</el-button></div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="members"><template #label><el-icon><Avatar /></el-icon> 成员 ({{ memberList.length }})</template>
        <div class="member-list" v-loading="memberLoading">
          <div style="margin-bottom:12px"><el-button type="primary" size="small" @click="showAddMemberDialog"><el-icon><Plus /></el-icon> 添加成员</el-button></div>
          <div v-for="m in memberList" :key="m.username" class="member-item">
            <el-avatar :size="40">{{ (m.username||'U').charAt(0).toUpperCase() }}</el-avatar>
            <div class="member-info"><div class="member-name">{{ m.username }}</div><el-tag :type="m.role==='admin'||m.role==='owner'?'danger':m.role==='write'?'warning':'info'" size="small">{{ m.role==='admin'||m.role==='owner'?'管理员':m.role==='write'?'写入':'只读' }}</el-tag></div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="settings"><template #label><el-icon><Setting /></el-icon> 设置</template>
        <div class="settings-container"><el-card><template #header>仓库设置</template>
          <el-form :model="settingsForm" label-width="100px">
            <el-form-item label="名称"><el-input v-model="settingsForm.name" /></el-form-item>
            <el-form-item label="描述"><el-input v-model="settingsForm.description" type="textarea" :rows="3" /></el-form-item>
            <el-form-item label="私有"><el-switch v-model="settingsForm.private" /></el-form-item>
            <el-form-item><el-button type="primary" @click="saveSettings" :loading="savingSettings">保存</el-button></el-form-item>
          </el-form>
        </el-card></div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="cloneDialogVisible" title="克隆仓库" width="500px"><p>HTTP: <el-input :model-value="httpCloneUrl" readonly /></p><p>SSH: <el-input :model-value="sshCloneUrl" readonly /></p></el-dialog>
    <el-dialog v-model="fileContentDialogVisible" :title="viewingFile.name" width="80%" top="5vh"><div v-loading="fileContentLoading" style="max-height:70vh;overflow:auto"><pre v-if="!fileContentLoading" class="file-content"><code>{{ viewingFile.content }}</code></pre></div></el-dialog>

    <!-- 差异对比 -->
    <el-dialog v-model="diffDialogVisible" :title="'提交 '+(diffData.sha||'').substring(0,7)" width="85%" top="5vh">
      <div v-loading="diffLoading">
        <div v-if="!diffLoading">
          <div class="diff-header">
            <p><strong>提交：</strong>{{ diffData.message }}</p>
            <p><strong>作者：</strong>{{ diffData.author }} | {{ diffData.date }}</p>
            <p><strong>变更：</strong>{{ diffData.files.length }} 个文件 | <span style="color:#67c23a">+{{ diffData.stats?.additions||0 }}</span> <span style="color:#f56c6c">-{{ diffData.stats?.deletions||0 }}</span></p>
          </div>
          <el-collapse v-if="diffData.files.length>0" v-model="activeDiffFiles">
            <el-collapse-item v-for="f in diffData.files" :key="f.name" :name="f.name">
              <template #title>
                <div class="diff-collapse-title">
                  <span class="diff-file-name">{{ f.name }}</span>
                  <el-tag :type="f.status==='added'?'success':f.status==='removed'?'danger':'warning'" size="small">{{ f.status==='added'?'新增':f.status==='removed'?'删除':'修改' }}</el-tag>
                  <span class="diff-stats"><span style="color:#67c23a">+{{ f.additions }}</span> <span style="color:#f56c6c">-{{ f.deletions }}</span></span>
                </div>
              </template>
              <div v-if="f.lines&&f.lines.length" class="diff-patch"><pre><code v-html="renderDiffLines(f.lines)"></code></pre></div>
              <div v-else class="diff-no-patch">二进制文件或无法显示差异</div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="addMemberDialogVisible" title="添加成员" width="450px">
      <el-form :model="addMemberForm" label-width="80px">
        <el-form-item label="用户名"><el-input v-model="addMemberForm.username" placeholder="Gitea 用户名" /></el-form-item>
        <el-form-item label="权限"><el-select v-model="addMemberForm.permission" style="width:100%"><el-option label="读取" value="read" /><el-option label="写入" value="write" /><el-option label="管理" value="admin" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="addMemberDialogVisible=false">取消</el-button><el-button type="primary" @click="handleAddMember" :loading="addMemberLoading">添加</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FolderOpened, Folder, User, Clock, Download, Document, Share, Collection, View, Connection, Link, Right, Avatar, Plus, Setting } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getRepo, getContents, getBranches, getTags, getCommits, getFileContent, getCommitDiff, getPullRequests, getRepoMembers, addRepoMember, updateRepo } from '@/api/gitea'

const route = useRoute(), router = useRouter(), userStore = useUserStore()
const loading = ref(false), activeTab = ref('files'), currentPath = ref(''), currentBranch = ref('main')

const repoInfo = reactive({ id: null, name: '', description: '', owner: '', defaultBranch: 'main', updatedAt: '' })
const breadcrumb = ref([{ name: 'root', path: '' }])
const fileList = ref([]), branchList = ref([]), tagList = ref([]), commitList = ref([])
const commitPage = ref(1), commitTotal = ref(0)

const cloneDialogVisible = ref(false), fileContentDialogVisible = ref(false), fileContentLoading = ref(false)
const viewingFile = ref({ name: '', path: '', content: '' })
const diffDialogVisible = ref(false), diffLoading = ref(false)
const diffData = ref({ sha: '', message: '', author: '', date: '', files: [], stats: {} })

const pullList = ref([]), pullLoading = ref(false)
const memberList = ref([]), memberLoading = ref(false)
const savingSettings = ref(false)
const addMemberDialogVisible = ref(false), addMemberLoading = ref(false)
const addMemberForm = reactive({ username: '', permission: 'write' })
const settingsForm = reactive({ name: '', description: '', private: true, defaultBranch: 'main' })

const repoType = computed(() => { const m = (repoInfo.description||'').match(/^\[(source|docs|config)\]/); return m ? m[1] : '' })
const repoTypeTag = computed(() => repoType.value === 'source' ? '' : repoType.value === 'docs' ? 'success' : 'warning')
const repoTypeLabel = computed(() => repoType.value === 'source' ? '源码' : repoType.value === 'docs' ? '文档' : repoType.value === 'config' ? '配置' : '')
const displayName = computed(() => {
  const m = (repoInfo.description||'').match(/\[显示名=([^\]]+)\]/)
  return m ? m[1] : repoInfo.name
})
const cleanDescription = computed(() => {
  return (repoInfo.description||'')
    .replace(/^\[(source|docs|config)\]\s*/, '')
    .replace(/\[显示名=[^\]]+\]\s*/, '')
    .replace(/\[(公开|秘密|机密|绝密)\]\s*/, '')
})
const httpCloneUrl = computed(() => `http://123.60.219.19:3000/${repoInfo.owner}/${repoInfo.name}.git`)
const sshCloneUrl = computed(() => `git@123.60.219.19:${repoInfo.owner}/${repoInfo.name}.git`)

onMounted(() => { loadRepoDetail(); loadBranches(); loadTags(); loadCommits(); loadPulls(); loadMembers() })

async function loadRepoDetail() {
  loading.value = true
  try {
    const { owner, name } = route.params
    const res = await getRepo(owner, name); const r = res.data || res
    Object.assign(repoInfo, { id: r.id, name: r.name, description: r.description||'', owner: r.owner?.login||r.owner?.username||'', defaultBranch: r.default_branch||'main', updatedAt: r.updated_at })
    settingsForm.name = r.name; settingsForm.description = r.description||''; settingsForm.private = r.private
  } catch { ElMessage.error('加载仓库信息失败') } finally { loading.value = false }
}

watch(activeTab, onTabChange)
function onTabChange(tab) { if (tab === 'files') loadFiles(); else if (tab === 'branches') loadBranches(); else if (tab === 'tags') loadTags(); else if (tab === 'commits') loadCommits(); else if (tab === 'pulls') loadPulls(); else if (tab === 'members') loadMembers() }

async function loadFiles() {
  const { owner, name } = route.params
  try {
    const ref = currentBranch.value || repoInfo.defaultBranch || 'main'
    const contents = await getContents(owner, name, currentPath.value || '', ref)
    const data = contents.data || contents
    const items = Array.isArray(data) ? data : [data]

    // 并行查询每个文件的最新提交
    const withCommits = await Promise.all(items.map(async f => {
      try {
        const path = f.path || f.name
        const commitsRes = await getCommits(owner, name, { sha: ref, limit: 1, path })
        const lastCommit = (commitsRes.data || commitsRes)?.[0]
        return {
          name: f.name, path, type: f.type,
          lastCommitMessage: lastCommit?.commit?.message || lastCommit?.message || '',
          lastCommitTime: lastCommit?.commit?.committer?.date || lastCommit?.commit?.author?.date || lastCommit?.created_at || ''
        }
      } catch {
        return { name: f.name, path: f.path || f.name, type: f.type, lastCommitMessage: '', lastCommitTime: '' }
      }
    }))
    fileList.value = withCommits
  } catch { fileList.value = [] }
}

async function loadBranches() {
  try { const b = await getBranches(route.params.owner, route.params.name); branchList.value = (b.data||b||[]).map(x => ({ name: x.name, isDefault: x.name===repoInfo.defaultBranch, isProtected: x.protected, commitMessage: x.commit?.message||'' })) } catch { branchList.value = [] }
}

async function loadTags() {
  try { const t = await getTags(route.params.owner, route.params.name); tagList.value = (t.data||t||[]).map(x => ({ name: x.name, message: x.message||'', sha: x.commit?.sha||'' })) } catch { tagList.value = [] }
}

async function loadCommits() {
  try { const c = await getCommits(route.params.owner, route.params.name, { page: commitPage.value, limit: 20 }); commitList.value = (c.data||c||[]).map(x => ({ sha: x.sha, message: x.commit?.message||x.message||'', author: x.author?.login||x.commit?.author?.name||'', createdAt: x.commit?.author?.date||'' })); commitTotal.value = commitList.value.length } catch { commitList.value = [] }
}

async function loadPulls() {
  pullLoading.value = true
  try { const p = await getPullRequests(route.params.owner, route.params.name); pullList.value = (p.data||p||[]).map(x => ({ id: x.id||x.number, title: x.title, sourceBranch: x.head?.label||x.head?.ref||'', targetBranch: x.base?.label||x.base?.ref||'', state: x.state==='open'?'open':(x.merged?'merged':'closed'), author: x.user?.username||'', createdAt: x.created_at||'', url: x.html_url||'' })) } catch { pullList.value = [] }
  finally { pullLoading.value = false }
}

async function loadMembers() {
  memberLoading.value = true
  try {
    const m = await getRepoMembers(route.params.owner, route.params.name)
    const data = m.data || m; const arr = (Array.isArray(data) ? data : []).map(x => ({ username: x.username||x.login||'', role: x.permissions?.admin?'admin':x.permissions?.push?'write':'read' }))
    const cur = userStore.userInfo?.username || userStore.username || ''
    const repoOwner = route.params.owner || repoInfo.owner || ''
    // 当前用户不在列表中则添加为 owner
    if (cur && !arr.some(x => x.username===cur)) arr.unshift({ username: cur, role: cur === repoOwner ? 'owner' : (arr.length > 0 ? 'write' : 'owner') })
    // 仓库拥有者不在列表中则添加
    if (repoOwner && !arr.some(x => x.username===repoOwner)) arr.unshift({ username: repoOwner, role: 'owner' })
    memberList.value = arr
  } catch { memberList.value = [] }
  finally { memberLoading.value = false }
}

function handleFileClick(f) { f.type==='dir' ? (currentPath.value=f.path, updateBreadcrumb(f.path), loadFiles()) : viewFileContent(f) }
function navigateToPath(p) { currentPath.value=p||''; updateBreadcrumb(p||''); loadFiles() }
function updateBreadcrumb(p) { const parts=(p||'').split('/').filter(Boolean); const c=[{name:repoInfo.name||'root',path:''}]; let a=''; parts.forEach(x=>{a+=(a?'/':'')+x;c.push({name:x,path:a})}); breadcrumb.value=c }

async function viewFileContent(f) {
  viewingFile.value = { name: f.name, path: f.path, content: '' }; fileContentDialogVisible.value = true; fileContentLoading.value = true
  try { const r = await getFileContent(route.params.owner, route.params.name, f.path); viewingFile.value.content = typeof r==='string'?r:(typeof r.data==='string'?r.data:(r.data||r)) } catch { viewingFile.value.content = '// 加载失败' }
  finally { fileContentLoading.value = false }
}

async function viewCommitDiff(commit) {
  diffData.value = { sha: commit.sha, message: commit.message, author: commit.author, date: commit.createdAt, files: [], stats: {} }
  diffDialogVisible.value = true; diffLoading.value = true
  try {
    const res = await getCommitDiff(route.params.owner, route.params.name, commit.sha)
    const d = (res.data?.data || res.data || res)
    diffData.value = { sha: d.sha||commit.sha, message: d.message||commit.message, author: d.author||commit.author, date: d.date||commit.createdAt, stats: d.stats||{}, files: (d.files||[]).map(f => ({ name: f.name, status: f.status||'modified', additions: f.additions||0, deletions: f.deletions||0, lines: f.lines||[] })) }
  } catch(e) { console.error('Diff error:', e) }
  finally { diffLoading.value = false }
}

const activeDiffFiles = ref([])
function renderDiffLines(lines) {
  if(!lines||!lines.length)return''
  return lines.map(l=>{
    const e=(l.c||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const prefix = l.t || ' '
    if(l.t==='+') return '<span class="diff-add">'+prefix+e+'</span>'
    if(l.t==='-') return '<span class="diff-del">'+prefix+e+'</span>'
    return '<span class="diff-ctx">'+prefix+e+'</span>'
  }).join('\n')
}

function viewBranch(b) { currentBranch.value=b.name; currentPath.value=''; breadcrumb.value=[{name:repoInfo.name||'root',path:''}]; activeTab.value='files'; loadFiles() }
function viewTag(t) { window.open(`http://123.60.219.19:3000/${route.params.owner}/${route.params.name}/releases/tag/${t.name}`, '_blank') }
function viewCommitDetail(c) { window.open(`http://123.60.219.19:3000/${route.params.owner}/${route.params.name}/commit/${c.sha}`, '_blank') }
function openPullUrl(p) { if(p.url) window.open(p.url, '_blank') }
function showCloneDialog() { cloneDialogVisible.value = true }
function downloadZip() { window.open(`http://123.60.219.19:3000/${route.params.owner}/${route.params.name}/archive/${repoInfo.defaultBranch||'main'}.zip`, '_blank') }

async function saveSettings() {
  savingSettings.value = true
  try { await updateRepo(route.params.owner, route.params.name, settingsForm); ElMessage.success('保存成功') } catch { ElMessage.error('保存失败') }
  finally { savingSettings.value = false }
}

function showAddMemberDialog() { addMemberForm.username=''; addMemberForm.permission='write'; addMemberDialogVisible.value=true }
async function handleAddMember() {
  if(!addMemberForm.username){ElMessage.warning('请输入用户名');return}
  addMemberLoading.value=true
  try { await addRepoMember(route.params.owner, route.params.name, addMemberForm.username, addMemberForm.permission); ElMessage.success('添加成功'); addMemberDialogVisible.value=false; loadMembers() }
  catch(e){ElMessage.error('添加失败:'+(e?.response?.data?.message||e?.message||''))}
  finally{addMemberLoading.value=false}
}

function formatTime(t) { if(!t)return'-'; return new Date(t).toLocaleString('zh-CN') }
</script>

<style lang="scss" scoped>
.repo-detail-container{background:#fff;border-radius:8px;overflow:hidden}
.repo-header{display:flex;justify-content:space-between;align-items:flex-start;padding:24px;border-bottom:1px solid #ebeef5;background:#fafafa}
.repo-title{display:flex;align-items:center;gap:8px;h1{margin:0;font-size:22px}}
.repo-subname{color:#909399;font-size:13px;margin:0;font-family:monospace}
.repo-description{color:#909399;margin:8px 0}
.repo-meta{display:flex;gap:16px;color:#909399;font-size:13px;span{display:flex;align-items:center;gap:4px}}
.repo-actions{display:flex;gap:8px;flex-shrink:0}
.repo-tabs{padding:0 24px}
.files-container{padding:12px 0}
.file-path{margin-bottom:12px}
.file-list{border:1px solid #ebeef5;border-radius:4px}
.file-item{display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #ebeef5;cursor:pointer;&:hover{background:#f5f7fa}&.header{font-weight:bold;background:#fafafa;cursor:default}&.is-dir{.file-name-col{color:#409eff;font-weight:bold}}}
.file-name-col{flex:1;display:flex;align-items:center;gap:6px}
.file-message-col{flex:1;color:#909399;font-size:13px}
.file-time-col{width:180px;color:#c0c4cc;font-size:13px}
.branch-list,.tag-list{padding:12px 0}
.branch-item,.tag-item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #ebeef5}
.tag-sha{color:#c0c4cc;font-size:12px;margin-left:auto}
.branch-commit{color:#909399;font-size:13px;margin-left:auto}
.commits-container{padding:12px 0}
.commit-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ebeef5}
.commit-sha{flex-shrink:0}
.commit-content{flex:1}
.commit-message{font-weight:bold}
.commit-meta{color:#909399;font-size:12px;display:flex;gap:12px}
.commit-actions{display:flex;gap:4px;flex-shrink:0}
.pull-item,.member-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ebeef5}
.pull-main{flex:1}
.pull-title{font-weight:bold}
.pull-branches{display:flex;align-items:center;gap:4px;margin-top:4px}
.pull-meta{display:flex;gap:12px;align-items:center;color:#909399;font-size:12px}
.member-info{flex:1;.member-name{font-weight:bold}}
.settings-container{max-width:600px;padding:20px}
.file-content{background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:4px;font-size:13px;line-height:1.5;overflow:auto;max-height:65vh;white-space:pre-wrap;word-break:break-all}
.diff-header{margin-bottom:16px;padding:12px;background:#f5f7fa;border-radius:4px;p{margin:4px 0}}
.diff-file{margin-bottom:20px;border:1px solid #e4e7ed;border-radius:4px;overflow:hidden}
.diff-file-header{padding:8px 12px;background:#f5f7fa;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e4e7ed}
.diff-file-name{font-weight:bold;flex:1}
.diff-patch{background:#1e1e1e;color:#ccc;padding:12px;overflow:auto;max-height:300px;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:1.4;pre{margin:0;white-space:pre}}
.diff-no-patch{padding:16px;text-align:center;color:#999}
.diff-collapse-title{display:flex;align-items:center;gap:8px;width:100%}
.diff-add{background:#1b3a1b;display:block}
.diff-del{background:#3a1b1b;display:block}
.diff-ctx{display:block}
.diff-stats{font-size:12px;margin-left:8px}
</style>
