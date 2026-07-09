<template>
  <div class="repo-detail-container" v-loading="loading">
    <!-- 仓库头部信息 -->
    <div class="repo-header">
      <div class="repo-info">
        <div class="repo-title">
          <el-icon class="repo-icon"><FolderOpened /></el-icon>
          <h1>{{ repoInfo.name }}</h1>
          <el-tag :type="getSecretLevelType(repoInfo.secretLevel)" size="small">
            {{ getSecretLevelName(repoInfo.secretLevel) }}
          </el-tag>
        </div>
        <p class="repo-description">{{ repoInfo.description || '暂无描述' }}</p>
        <div class="repo-meta">
          <span><el-icon><User /></el-icon> {{ repoInfo.owner }}</span>
          <span><el-icon><OfficeBuilding /></el-icon> {{ repoInfo.deptName }}</span>
          <span><el-icon><Timer /></el-icon> 最后更新于 {{ formatTime(repoInfo.updatedAt) }}</span>
        </div>
      </div>
      <div class="repo-actions">
        <el-button type="primary" @click="showCloneDialog">
          <el-icon><Download /></el-icon>
          克隆
        </el-button>
        <el-button @click="showGitCommands">
          <el-icon><Terminal /></el-icon>
          Git命令
        </el-button>
        <el-dropdown @command="handleMoreAction">
          <el-button>
            更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="settings">仓库设置</el-dropdown-item>
              <el-dropdown-item command="members">成员管理</el-dropdown-item>
              <el-dropdown-item command="transfer">移交仓库</el-dropdown-item>
              <el-dropdown-item command="archive" divided>归档仓库</el-dropdown-item>
              <el-dropdown-item command="delete" divided>删除仓库</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Tab导航 -->
    <el-tabs v-model="activeTab" class="repo-tabs">
      <!-- 代码浏览 -->
      <el-tab-pane label="代码" name="files">
        <template #label>
          <el-icon><Document /></el-icon>
          代码
        </template>
        <div class="files-container">
          <div class="file-path">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item 
                v-for="(crumb, index) in breadcrumb" 
                :key="index"
                @click="navigateToPath(crumb.path)"
                style="cursor: pointer"
              >
                {{ crumb.name }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          
          <div class="file-list">
            <div class="file-item header">
              <span class="file-name-col">文件名</span>
              <span class="file-message-col">提交信息</span>
              <span class="file-time-col">提交时间</span>
            </div>
            <div 
              v-for="file in fileList" 
              :key="file.path"
              class="file-item"
              :class="{ 'is-dir': file.type === 'dir' }"
              @click="handleFileClick(file)"
            >
              <span class="file-name-col">
                <el-icon v-if="file.type === 'dir'"><Folder /></el-icon>
                <el-icon v-else><Document /></el-icon>
                <span>{{ file.name }}</span>
              </span>
              <span class="file-message-col">{{ file.lastCommitMessage }}</span>
              <span class="file-time-col">{{ formatTime(file.lastCommitTime) }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 分支管理 -->
      <el-tab-pane label="分支" name="branches">
        <template #label>
          <el-icon><Share /></el-icon>
          分支 ({{ branchList.length }})
        </template>
        <div class="branches-container">
          <div class="branch-toolbar">
            <el-input 
              v-model="branchSearch" 
              placeholder="搜索分支" 
              prefix-icon="Search"
              style="width: 200px"
            />
            <el-button type="primary" @click="showCreateBranch">
              <el-icon><Plus /></el-icon>
              新建分支
            </el-button>
          </div>
          <div class="branch-list">
            <div 
              v-for="branch in filteredBranches" 
              :key="branch.name"
              class="branch-item"
            >
              <div class="branch-info">
                <el-icon v-if="branch.isDefault"><Star /></el-icon>
                <el-icon v-else><Branch /></el-icon>
                <span class="branch-name">{{ branch.name }}</span>
                <el-tag v-if="branch.isProtected" type="warning" size="small">保护</el-tag>
              </div>
              <div class="branch-meta">
                <span>{{ branch.commitMessage }}</span>
                <span>{{ formatTime(branch.updatedAt) }}</span>
              </div>
              <div class="branch-actions">
                <el-button type="primary" link @click="switchToBranch(branch)">切换</el-button>
                <el-button type="primary" link @click="createMergeRequest(branch)">合并</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 版本标签 -->
      <el-tab-pane label="版本" name="tags">
        <template #label>
          <el-icon><Collection /></el-icon>
          版本 ({{ tagList.length }})
        </template>
        <div class="tags-container">
          <div class="tag-toolbar">
            <el-button type="primary" @click="showCreateTag" v-if="canCreateTag">
              <el-icon><Plus /></el-icon>
              创建版本
            </el-button>
            <el-button @click="showBaselineDialog">
              <el-icon><Lock /></el-icon>
              基线管理
            </el-button>
          </div>
          <div class="tag-list">
            <div 
              v-for="tag in tagList" 
              :key="tag.name"
              class="tag-item"
            >
              <div class="tag-info">
                <el-icon><Collection /></el-icon>
                <span class="tag-name">{{ tag.name }}</span>
                <el-tag v-if="tag.isBaseline" type="success" size="small">基线</el-tag>
                <el-tag v-if="tag.isReleased" type="primary" size="small">已发布</el-tag>
              </div>
              <div class="tag-meta">
                <span>{{ tag.message }}</span>
                <span>{{ tag.author }} · {{ formatTime(tag.createdAt) }}</span>
              </div>
              <div class="tag-actions">
                <el-button type="primary" link @click="viewTagDetail(tag)">详情</el-button>
                <el-button type="primary" link @click="downloadTag(tag)" v-if="canDownload">下载</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 提交历史 -->
      <el-tab-pane label="提交" name="commits">
        <template #label>
          <el-icon><Clock /></el-icon>
          提交
        </template>
        <div class="commits-container">
          <div class="commit-toolbar">
            <el-select v-model="currentBranch" placeholder="选择分支" style="width: 150px">
              <el-option v-for="b in branchList" :key="b.name" :label="b.name" :value="b.name" />
            </el-select>
          </div>
          <div class="commit-list">
            <div 
              v-for="commit in commitList" 
              :key="commit.sha"
              class="commit-item"
            >
              <div class="commit-sha">
                <el-tag type="info" size="small">{{ commit.sha.substring(0, 7) }}</el-tag>
              </div>
              <div class="commit-content">
                <div class="commit-message">{{ commit.message }}</div>
                <div class="commit-meta">
                  <el-avatar :size="20" :icon="UserFilled" />
                  <span class="commit-author">{{ commit.author }}</span>
                  <span class="commit-time">提交于 {{ formatTime(commit.createdAt) }}</span>
                </div>
              </div>
              <div class="commit-actions">
                <el-button type="primary" link @click="viewCommitDetail(commit)">查看</el-button>
                <el-button type="primary" link @click="viewCommitDiff(commit)">差异</el-button>
              </div>
            </div>
          </div>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="commitPage"
              :page-size="20"
              :total="commitTotal"
              layout="prev, pager, next"
              @current-change="loadCommits"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- 合并请求 -->
      <el-tab-pane label="合并请求" name="merges">
        <template #label>
          <el-icon><Merge /></el-icon>
          合并请求
        </template>
        <div class="merge-list">
          <el-empty description="暂无合并请求" />
        </div>
      </el-tab-pane>

      <!-- 仓库设置 -->
      <el-tab-pane label="设置" name="settings" v-if="canEditSettings">
        <template #label>
          <el-icon><Setting /></el-icon>
          设置
        </template>
        <div class="settings-container">
          <el-form label-width="120px">
            <el-form-item label="仓库名称">
              <el-input v-model="repoInfo.name" />
            </el-form-item>
            <el-form-item label="仓库描述">
              <el-input v-model="repoInfo.description" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="默认分支">
              <el-select v-model="repoInfo.defaultBranch">
                <el-option v-for="b in branchList" :key="b.name" :label="b.name" :value="b.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="保护默认分支">
              <el-switch v-model="repoInfo.protectDefaultBranch" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSettings">保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 克隆对话框 -->
    <el-dialog v-model="cloneDialogVisible" title="克隆仓库" width="500px">
      <div class="clone-content">
        <el-form label-width="100px">
          <el-form-item label="HTTP克隆">
            <el-input :value="httpCloneUrl" readonly />
          </el-form-item>
          <el-form-item label="SSH克隆">
            <el-input :value="sshCloneUrl" readonly />
          </el-form-item>
        </el-form>
        <div class="clone-commands">
          <p>克隆命令：</p>
          <div class="code-block">
            <pre>git clone {{ httpCloneUrl }}</pre>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="copyUrl(httpCloneUrl)">复制HTTP</el-button>
        <el-button @click="copyUrl(sshCloneUrl)">复制SSH</el-button>
        <el-button type="primary" @click="cloneDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FolderOpened, User, OfficeBuilding, Timer, Download, Terminal, Document, Share, Plus, Collection, Lock, Clock, Merge, Setting } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getRepo, getContents, getBranches, getTags, getCommits } from '@/api/gitea'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const activeTab = ref('files')
const repoInfo = reactive({
  name: '',
  description: '',
  owner: '',
  deptName: '',
  secretLevel: 'internal',
  defaultBranch: 'main',
  updatedAt: '',
  protectDefaultBranch: true
})

const breadcrumb = ref([{ name: repoInfo.name || 'root', path: '' }])
const fileList = ref([
  { name: 'src', path: 'src', type: 'dir', lastCommitMessage: '添加源码目录', lastCommitTime: '2024-01-15 10:00' },
  { name: 'README.md', path: 'README.md', type: 'file', lastCommitMessage: 'Initial commit', lastCommitTime: '2024-01-15 09:00' },
  { name: 'package.json', path: 'package.json', type: 'file', lastCommitMessage: '添加项目配置', lastCommitTime: '2024-01-14 15:30' }
])

const branchList = ref([
  { name: 'main', isDefault: true, isProtected: true, commitMessage: 'Merge pull request #1', updatedAt: '2024-01-15 10:00' },
  { name: 'develop', isDefault: false, isProtected: true, commitMessage: 'Add new feature', updatedAt: '2024-01-14 16:00' },
  { name: 'feature/user-module', isDefault: false, isProtected: false, commitMessage: 'Update user controller', updatedAt: '2024-01-13 11:00' }
])
const branchSearch = ref('')
const currentBranch = ref('main')

const tagList = ref([
  { name: 'v1.0.0', message: '正式版本发布', author: '张三', isBaseline: true, isReleased: true, createdAt: '2024-01-10' },
  { name: 'v0.9.0', message: '测试版本', author: '李四', isBaseline: false, isReleased: false, createdAt: '2024-01-05' }
])

const commitList = ref([
  { sha: 'a1b2c3d4e5f6', message: 'Add user authentication module', author: '张三', createdAt: '2024-01-15 10:30' },
  { sha: 'b2c3d4e5f6a1', message: 'Fix login validation bug', author: '李四', createdAt: '2024-01-14 15:20' }
])
const commitPage = ref(1)
const commitTotal = ref(100)

const cloneDialogVisible = ref(false)

const httpCloneUrl = computed(() => `http://123.60.219.19:3000/${repoInfo.owner}/${repoInfo.name}.git`)
const sshCloneUrl = computed(() => `git@123.60.219.19:${repoInfo.owner}/${repoInfo.name}.git`)

const filteredBranches = computed(() => {
  if (!branchSearch.value) return branchList.value
  return branchList.value.filter(b => b.name.includes(branchSearch.value))
})

const canCreateTag = computed(() => userStore.hasPermission('tag:create'))
const canDownload = computed(() => userStore.hasPermission('repo:download'))
const canEditSettings = computed(() => userStore.hasPermission('repo:edit') || repoInfo.owner === userStore.userInfo?.username)

onMounted(() => {
  loadRepoDetail()
})

async function loadRepoDetail() {
  loading.value = true
  try {
    const owner = route.params.owner
    const name = route.params.name
    const res = await getRepo(owner, name)
    const repo = res.data || res
    Object.assign(repoInfo, {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '',
      owner: repo.owner?.login || repo.owner?.username || '',
      private: repo.private,
      stars_count: repo.stars_count || 0,
      forks_count: repo.forks_count || 0,
      default_branch: repo.default_branch || 'main',
      updated_at: repo.updated_at
    })
  } catch (error) {
    ElMessage.error('加载仓库信息失败')
  } finally {
    loading.value = false
  }
}

function loadCommits() {
  // 加载提交历史
}

function getSecretLevelType(level) {
  const map = { 'public': '', 'internal': 'warning', 'secret': 'danger', 'top-secret': 'danger' }
  return map[level] || ''
}

function getSecretLevelName(level) {
  const map = { 'public': '公开', 'internal': '内部', 'secret': '涉密', 'top-secret': '机密' }
  return map[level] || level
}

function formatTime(time) {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN')
}

function showCloneDialog() {
  cloneDialogVisible.value = true
}

function showGitCommands() {
  ElMessage.info('Git命令提示功能开发中')
}

function copyUrl(url) {
  navigator.clipboard.writeText(url)
  ElMessage.success('已复制到剪贴板')
}

function handleMoreAction(command) {
  switch (command) {
    case 'settings':
      activeTab.value = 'settings'
      break
    case 'members':
      ElMessage.info('成员管理功能开发中')
      break
    case 'delete':
      ElMessageBox.confirm('确定要删除仓库吗？此操作不可恢复！', '删除确认', { type: 'warning' })
        .then(() => {
          ElMessage.success('删除成功')
          router.push('/repos')
        })
      break
  }
}

function handleFileClick(file) {
  if (file.type === 'dir') {
    breadcrumb.value.push({ name: file.name, path: file.path })
  }
}

function navigateToPath(path) {
  // 导航到指定路径
}

function showCreateBranch() {
  ElMessage.info('创建分支功能开发中')
}

function switchToBranch(branch) {
  currentBranch.value = branch.name
  ElMessage.success(`已切换到分支: ${branch.name}`)
}

function createMergeRequest(branch) {
  router.push(`/branches/merge?source=${branch.name}`)
}

function showCreateTag() {
  ElMessage.info('创建版本功能开发中')
}

function showBaselineDialog() {
  router.push('/versions/baseline')
}

function viewTagDetail(tag) {
  ElMessage.info(`查看版本: ${tag.name}`)
}

function downloadTag(tag) {
  ElMessage.info(`下载版本: ${tag.name}`)
}

function viewCommitDetail(commit) {
  ElMessage.info(`查看提交: ${commit.sha.substring(0, 7)}`)
}

function viewCommitDiff(commit) {
  ElMessage.info(`查看差异: ${commit.sha.substring(0, 7)}`)
}

function saveSettings() {
  ElMessage.success('设置保存成功')
}
</script>

<style lang="scss" scoped>
.repo-detail-container {
  background: #fff;
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;

  .repo-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;

    .repo-icon {
      font-size: 32px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
    }
  }

  .repo-description {
    margin-bottom: 12px;
    opacity: 0.9;
  }

  .repo-meta {
    display: flex;
    gap: 20px;
    font-size: 14px;
    opacity: 0.8;

    span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .repo-actions {
    display: flex;
    gap: 10px;
  }
}

.repo-tabs {
  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 24px;
    background: #fafafa;
  }
}

.files-container, .branches-container, .tags-container, .commits-container {
  padding: 20px;
}

.file-path {
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.file-list, .branch-list, .tag-list, .commit-list {
  .file-item, .branch-item, .tag-item, .commit-item {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    border-bottom: 1px solid #ebeef5;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    &.header {
      background: #fafafa;
      font-weight: 600;
      color: #606266;
    }

    &.is-dir {
      cursor: pointer;
    }
  }
}

.file-name-col {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-message-col {
  flex: 1;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-time-col {
  flex: 0 0 160px;
  color: #909399;
  font-size: 12px;
}

.branch-toolbar, .tag-toolbar, .commit-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.branch-info, .tag-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;

  .branch-name, .tag-name {
    font-weight: 500;
    color: #303133;
  }
}

.branch-meta, .tag-meta, .commit-meta {
  flex: 2;
  color: #909399;
  font-size: 13px;
}

.branch-actions, .tag-actions, .commit-actions {
  display: flex;
  gap: 10px;
}

.commit-item {
  .commit-sha {
    flex: 0 0 80px;
  }

  .commit-content {
    flex: 1;

    .commit-message {
      color: #303133;
      margin-bottom: 4px;
    }
  }
}

.clone-content {
  .clone-commands {
    margin-top: 20px;

    p {
      color: #606266;
      margin-bottom: 10px;
    }
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

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.settings-container {
  max-width: 600px;
  padding: 20px;
}
</style>
