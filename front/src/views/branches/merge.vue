<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">合并请求</h2>
      <div class="button-group">
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          创建合并请求
        </el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已合并" value="merged" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="filterForm.repoId" placeholder="选择仓库" clearable style="width: 200px">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.full_name || repo.name" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="mergeRequestList" v-loading="loading" stripe border>
      <el-table-column label="编号" width="80">
        <template #default="{ row }">
          <span class="mr-id">#{{ row.bffApprovalId || row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column label="标题" min-width="250">
        <template #default="{ row }">
          <div class="mr-title" @click="viewDetail(row)">
            <span>{{ row.title }}</span>
          </div>
          <div class="mr-branches">
            <el-tag size="small">{{ row.sourceBranch }}</el-tag>
            <span class="arrow">→</span>
            <el-tag size="small" type="primary">{{ row.targetBranch }}</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="repoName" label="仓库" width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="审批进度" width="150">
        <template #default="{ row }">
          <div class="approval-progress">
            <el-progress :percentage="row.approvalRate" :color="getProgressColor(row.approvalRate)" />
            <span class="approval-text">{{ row.approvals }}/{{ row.requiredApprovals }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="申请人" width="100" />
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewDetail(row)">查看</el-button>
          <el-button type="warning" link @click="handleWithdraw(row)" v-if="row.status === 'pending' && (row.author === userStore.username || row.applicant_username === userStore.username)">撤回请求</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadData"
      />
    </div>

    <el-dialog v-model="createDialogVisible" title="创建合并请求" width="700px">
      <el-form :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="标题" prop="title" class="form-required">
          <el-input v-model="createForm.title" placeholder="请输入合并请求标题" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="详细描述此次合并的变更内容" />
        </el-form-item>
        <el-form-item label="仓库" prop="sourceRepoId" class="form-required">
          <el-select v-model="createForm.sourceRepoId" placeholder="选择仓库" @change="onSourceRepoChange">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.full_name || repo.name" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="源分支" prop="sourceBranch" class="form-required">
          <el-select v-model="createForm.sourceBranch" placeholder="选择源分支">
            <el-option v-for="branch in sourceBranches" :key="branch" :label="branch" :value="branch" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标分支" prop="targetBranch" class="form-required">
          <el-select v-model="createForm.targetBranch" placeholder="选择目标分支">
            <el-option v-for="branch in targetBranches" :key="branch" :label="branch" :value="branch" />
          </el-select>
        </el-form-item>
        <el-form-item label="审批流程">
          <span class="form-text">系统将自动使用默认审批流程，审批人自动分配为部门项目管理员和系统管理员</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建合并请求</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="合并请求详情" width="900px">
      <div class="mr-detail" v-if="currentMR">
        <div class="detail-header">
          <h3>{{ currentMR.title }}</h3>
          <el-tag :type="getStatusType(currentMR.status)">{{ getStatusName(currentMR.status) }}</el-tag>
        </div>
        
        <el-divider />
        
        <div class="detail-info">
          <div class="info-row">
            <span class="label">申请人：</span>
            <span>{{ currentMR.author }}</span>
          </div>
          <div class="info-row">
            <span class="label">源分支：</span>
            <el-tag size="small">{{ currentMR.sourceBranch }}</el-tag>
            <span class="arrow">→</span>
            <el-tag size="small" type="primary">{{ currentMR.targetBranch }}</el-tag>
          </div>
          <div class="info-row">
            <span class="label">创建时间：</span>
            <span>{{ formatTime(currentMR.createdAt) }}</span>
          </div>
        </div>

        <el-divider content-position="left">变更内容</el-divider>
        <div v-if="prDiffLoading" style="text-align:center;padding:20px;color:#909399">加载差异中...</div>
        <div v-else-if="currentMR?.files?.length">
          <div class="diff-stats-bar">
            <span class="stat added">+ {{ currentMR.additions }} 行</span>
            <span class="stat removed">- {{ currentMR.deletions }} 行</span>
            <span class="stat files">{{ currentMR.fileChanges }} 个文件</span>
          </div>
          <div class="diff-file-table">
            <div class="diff-table-header">
              <span class="col-status">状态</span>
              <span class="col-path">文件路径</span>
              <span class="col-stats">变更</span>
            </div>
            <div v-for="f in currentMR.files" :key="f.path" class="diff-table-row">
              <span class="col-status">
                <el-tag :type="f.status==='added'?'success':f.status==='removed'?'danger':'warning'" size="small">{{ f.status==='added'?'新增':f.status==='removed'?'删除':f.status==='renamed'?'重命名':'修改' }}</el-tag>
              </span>
              <span class="col-path">{{ f.path }}</span>
              <span class="col-stats">
                <span style="color:#67c23a">+ {{ f.additions||0 }}</span>
                <span style="color:#f56c6c;margin-left:8px">- {{ f.deletions||0 }}</span>
              </span>
            </div>
          </div>
        </div>
        <div v-else style="text-align:center;padding:20px;color:#909399">暂无文件变更</div>

        <el-divider content-position="left">审批记录</el-divider>
        <div class="approval-records">
          <div v-for="record in currentMR.approvalRecords" :key="record.id" class="record-item">
            <span>{{ record.user?.login || record.reviewer }}</span>
            <el-tag :type="record.state==='APPROVED'?'success':record.state==='REJECTED'?'danger':'info'" size="small">
              {{ record.state==='APPROVED'?'通过':record.state==='REJECTED'?'拒绝':'评审中' }}
            </el-tag>
          </div>
          <el-empty v-if="!currentMR.approvalRecords?.length" description="暂无审批记录" />
        </div>

      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button @click="showApprovalDialog" type="primary" v-if="canApprove && (currentMR?.status === 'pending' || currentMR?.status === 'open')">审批</el-button>
        <el-button type="success" @click="handleMerge" v-if="currentMR?.status === 'approved' && !currentMR?._giteaMerged">合并</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="approvalDialogVisible" title="审批合并请求" width="500px">
      <el-form :model="approvalForm" label-width="100px">
        <el-form-item label="审批结果">
          <el-radio-group v-model="approvalForm.status">
            <el-radio label="approved">通过</el-radio>
            <el-radio label="rejected">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input v-model="approvalForm.comment" type="textarea" :rows="4" placeholder="请输入审批意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false" :disabled="submittingApproval">取消</el-button>
        <el-button type="primary" @click="submitApproval" :loading="submittingApproval">
          {{ submittingApproval ? '提交中...' : '提交' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Link } from '@element-plus/icons-vue'
import { getPullRequests, getMyRepos, getBranches, createPullRequest, mergePullRequest, closePullRequest, getPullRequestFiles, getPullRequestReviews, submitPullRequestReview } from '@/api/gitea'
import { getApprovalFlows, createApproval, processApproval, withdrawApproval } from '@/api/bff'
import { getMergeApprovals } from '@/api/approval'
import { getUserList } from '@/api/user'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const canApprove = computed(() => {
  const role = userStore.userInfo?.role || ''
  return role === 'admin' || role === 'project_manager'
})

const loading = ref(false)
const submittingApproval = ref(false)
const prDiffLoading = ref(false)
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const approvalDialogVisible = ref(false)

const filterForm = reactive({
  status: '',
  repoId: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const mergeRequestList = ref([])
const repoList = ref([])

const currentMR = ref(null)

const createForm = reactive({
  title: '',
  description: '',
  sourceRepoId: '',
  sourceBranch: '',
  targetRepoId: '',
  targetBranch: '',
  approvalFlowId: '',
  reviewers: []
})

const createRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  sourceRepoId: [{ required: true, message: '请选择源仓库', trigger: 'change' }],
  sourceBranch: [{ required: true, message: '请选择源分支', trigger: 'change' }],
  targetRepoId: [{ required: true, message: '请选择目标仓库', trigger: 'change' }],
  targetBranch: [{ required: true, message: '请选择目标分支', trigger: 'change' }]
}

const sourceBranches = ref([])
const targetBranches = ref([])
const approvalFlows = ref([])
const reviewerOptions = ref([])

const approvalForm = reactive({
  status: 'approved',
  comment: ''
})

onMounted(async () => {
  if (route.query.source) {
    createForm.sourceBranch = route.query.source
    // 等待仓库列表加载后自动填入源仓库
    await loadRepos()
    // 优先通过 owner+name 匹配仓库（更可靠），repoId 仅作备选且需转换为数字
    let repoFound = false
    if (route.query.repoOwner && route.query.repoName) {
      const repo = repoList.value.find(r => r.owner === route.query.repoOwner && r.repo === route.query.repoName)
      if (repo) { createForm.sourceRepoId = repo.id; repoFound = true; loadSourceBranches() }
    }
    if (!repoFound && route.query.repoId) {
      const repo = repoList.value.find(r => r.id === Number(route.query.repoId))
      if (repo) { createForm.sourceRepoId = repo.id; loadSourceBranches() }
    }
    // 目标仓库锁定为源仓库（只支持同仓库合并），加载目标分支
    if (repoFound || route.query.repoId) {
      createForm.targetRepoId = createForm.sourceRepoId
      loadTargetBranches()
    }
    createDialogVisible.value = true
  }
  // 主数据加载
  loadData()
  if (!route.query.source) loadRepos()
  loadApprovalFlows()
  loadReviewers()
})

async function loadRepos() {
  try {
    const res = await getMyRepos()
    const repos = res.data || res
    // 获取用户可见的仓库元数据（部门+密级过滤）
    let visibleRepos = null
    try {
      const metaRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/bff'}/repo-meta/visible`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('gitea_token')}` }
      })
      const meta = await metaRes.json()
      visibleRepos = meta.data || meta || []
    } catch { /* 获取失败则显示全部 */ }

    repoList.value = (Array.isArray(repos) ? repos : []).map(r => {
      const ownerName = r.owner?.login || r.owner?.username || r.owner?.name || ''
      const repoName = r.name || ''
      return {
        id: r.id,
        name: r.full_name || r.name,
        owner: ownerName,
        repo: repoName,
        full_name: r.full_name || `${ownerName}/${repoName}`
      }
    })

    // 按部门密级过滤（始终生效，非管理员无可见仓库则列表为空）
    if (visibleRepos !== null) {
      const allowed = new Set(visibleRepos.map(m => `${m.repo_owner}/${m.repo_name}`))
      repoList.value = repoList.value.filter(r => allowed.has(`${r.owner}/${r.repo}`))
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    ElMessage.warning('加载仓库列表失败')
  }
}

async function loadApprovalFlows() {
  try {
    const res = await getApprovalFlows()
    const data = res.data || res
    approvalFlows.value = (Array.isArray(data) ? data : data.list || data.records || []).map(f => ({
      id: f.id,
      name: f.name || f.title
    }))
  } catch {
    // flows are optional
  }
}

async function loadReviewers() {
  try {
    const res = await getUserList({ page: 1, pageSize: 50 })
    const data = res.data || res
    const list = data.list || data.records || data || []
    reviewerOptions.value = (Array.isArray(list) ? list : []).map(u => ({
      label: u.nickname || u.username || u.name,
      value: u.username || u.id
    }))
  } catch {
    // reviewers are optional
  }
}

async function loadData() {
  loading.value = true
  try {
    // ===== 主数据源：从 BFF approvals 表加载合并请求列表 =====
    // 一次性取较多数据，前端做用户过滤 + 分页切片（与分支页保持一致）
    const params = { page: 1, pageSize: 200 }
    if (filterForm.status) params.status = filterForm.status

    const res = await getMergeApprovals(params)
    const bffList = res.data?.list || res.data || []
    const list = Array.isArray(bffList) ? bffList.map(item => ({
      ...item,
      userApproval: item.userApproval || null,
      approvals: item.approvals || 0,
      requiredApprovals: item.requiredApprovals || 1,
      approvalRate: item.approvalRate || 0,
      approvalRecords: item.approvalRecords || [],
      files: item.files || [],
      additions: item.additions || 0,
      deletions: item.deletions || 0,
      fileChanges: item.fileChanges || 0,
    })) : []

    // ===== 并发从 Gitea 补充 PR 详情（不影响主数据显示） =====
    await Promise.allSettled(list.map(async (item) => {
      const prNumber = item.giteaPrNumber
      if (!item.owner || !item.repo || !prNumber) return
      try {
        const [reviewRes, prRes] = await Promise.all([
          getPullRequestReviews(item.owner, item.repo, prNumber),
          getPullRequests(item.owner, item.repo, { state: 'all', page: 1, limit: 1 })
        ])
        const reviews = reviewRes.data || reviewRes || []
        const approvals = Array.isArray(reviews) ? reviews : []
        item.approvalRecords = approvals
        item.approvals_ = approvals.filter(r => r.state === 'APPROVED').length

        const prs = prRes.data || prRes
        const pr = Array.isArray(prs) ? prs.find(p => (p.number || p.id) === prNumber) : null
        if (pr) {
          item.sourceBranch = pr.head?.label || pr.head?.ref || item.sourceBranch
          item.targetBranch = pr.base?.label || pr.base?.ref || item.targetBranch
          item.state = pr.state || item.state
          item.merged = pr.merged || item.merged
          // 如果 Gitea PR 已合并，同步状态为 merged（覆盖 BFF 'approved' 状态）
          if (pr.merged && item.status === 'approved') {
            item.status = 'merged'
            item._giteaMerged = true
          }
        }
      } catch (e) { /* Gitea 补充失败不影响主数据 */ }
    }))

    // 只显示当前用户发起的合并请求
    const currentUser = userStore.username || userStore.userInfo?.username || ''
    const filtered = list.filter(item => item.author === currentUser || item.applicant_username === currentUser)
    pagination.total = filtered.length
    // 客户端分页切片（与分支页保持一致的实现方式）
    const start = (pagination.page - 1) * pagination.pageSize
    mergeRequestList.value = filtered.slice(start, start + pagination.pageSize)
  } catch (error) {
    console.error('加载合并请求列表失败:', error)
    ElMessage.warning('加载合并请求列表失败：' + (error.message || '网络错误'))
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  loadData()
}

function showCreateDialog() {
  createDialogVisible.value = true
}

async function onSourceRepoChange() {
  // 目标仓库锁定为源仓库（只支持同仓库合并）
  createForm.targetRepoId = createForm.sourceRepoId
  createForm.sourceBranch = ''
  createForm.targetBranch = ''
  await loadSourceBranches()
  await loadTargetBranches()
}

async function loadSourceBranches() {
  const repo = repoList.value.find(r => r.id === createForm.sourceRepoId)
  if (!repo) return
  try {
    const res = await getBranches(repo.owner, repo.repo)
    const branches = res.data || res
    sourceBranches.value = (Array.isArray(branches) ? branches : []).map(b => b.name)
  } catch (error) {
    ElMessage.warning('加载源分支列表失败')
  }
}

async function loadTargetBranches() {
  const repo = repoList.value.find(r => r.id === createForm.targetRepoId)
  if (!repo) return
  try {
    const res = await getBranches(repo.owner, repo.repo)
    const branches = res.data || res
    targetBranches.value = (Array.isArray(branches) ? branches : []).map(b => b.name)
  } catch (error) {
    ElMessage.warning('加载目标分支列表失败')
  }
}

async function handleCreate() {
  const sourceRepo = repoList.value.find(r => r.id === createForm.sourceRepoId)
  const targetRepo = repoList.value.find(r => r.id === createForm.targetRepoId)
  if (!sourceRepo || !targetRepo) { ElMessage.warning('请选择仓库'); return }
  if (!createForm.sourceBranch || !createForm.targetBranch) { ElMessage.warning('请选择分支'); return }
  if (createForm.sourceBranch === createForm.targetBranch) { ElMessage.warning('源分支和目标分支不能相同'); return }
  try {
    // 1. 先在 Gitea 创建 PR
    const prRes = await createPullRequest(sourceRepo.owner, sourceRepo.repo, {
      title: createForm.title,
      head: createForm.sourceBranch,
      base: createForm.targetBranch,
      body: createForm.description
    })
    
    // 获取创建的 PR 编号
    const prNumber = prRes.data?.number || prRes.data?.id || prRes.number || prRes.id
    
    // 2. 在 BFF 数据库创建审批记录，关联 PR 编号
    let bffApprovalId = null
    try {
      const approvalRes = await createApproval({
        operationType: 'merge',
        title: createForm.title,
        description: createForm.description,
        repoOwner: sourceRepo.owner,
        repoName: sourceRepo.repo,
        sourceBranch: createForm.sourceBranch,
        targetBranch: createForm.targetBranch,
        urgency: 'normal',
        secretLevel: 'internal',
        giteaPrNumber: prNumber
      })
      bffApprovalId = approvalRes.data?.approvalId
    } catch (approvalError) {
      console.warn('创建审批记录失败（不影响 PR 创建）:', approvalError)
    }
    
    ElMessage.success('合并请求创建成功，审批流程已启动')
    createDialogVisible.value = false
    
    // 添加到列表中（确保新创建的 PR 立即可见）
    if (prNumber) {
      mergeRequestList.value.unshift({
        id: prRes.data?.number || prNumber,
        number: prRes.data?.number || prNumber,
        giteaPrNumber: prNumber,
        title: createForm.title,
        sourceBranch: createForm.sourceBranch,
        targetBranch: createForm.targetBranch,
        repoId: sourceRepo.id,
        repoName: sourceRepo.name,
        state: 'open',
        status: 'pending',
        approvals: 0,
        requiredApprovals: 1,
        approvalRate: 0,
        author: userStore.userInfo?.username || userStore.userInfo?.login || '我',
        createdAt: new Date().toISOString(),
        bffApprovalId: bffApprovalId,
        owner: sourceRepo.owner,
        repo: sourceRepo.repo
      })
    }
    
    loadData()
  } catch (error) {
    console.error('创建合并请求失败:', error)
    if (error?.response?.status === 409) {
      const giteaDetail = error?.response?.data?.message || ''
      // 尝试从错误消息中提取已有 PR ID，直接跳转
      const idMatch = giteaDetail.match(/\[id:\s*(\d+)/)
      if (idMatch) {
        const existingId = parseInt(idMatch[1])
        // 刷新列表后查找并打开已有 PR
        await loadData()
        const existing = mergeRequestList.value.find(m => (m.id || m.number) === existingId)
        if (existing) {
          viewDetail(existing)
          ElMessage.warning(`已存在合并请求 #${existingId}，已为你打开`)
          return
        }
      }
      ElMessage.warning('创建合并请求失败: ' + (giteaDetail || '已存在合并请求，请先关闭旧 PR'))
    } else {
      const giteaDetail = error?.response?.data?.message || error?.response?.data?.error || ''
      const msg = error?.response?.status === 422 ? `请求无效: ${giteaDetail || '请检查分支是否存在且有差异'}`
                : (error?.message || '未知错误')
      ElMessage.warning('创建合并请求失败: ' + msg)
    }
  }
}

async function viewDetail(row) {
  currentMR.value = { ...row }
  detailDialogVisible.value = true
  prDiffLoading.value = true
  const owner = row.owner
  const repo = row.repo
  const prNumber = row.giteaPrNumber
  if (owner && repo && prNumber) {
    try {
      // 并发获取 PR 文件变更和 PR 详情（含合并状态）
      const [filesRes, prDetailRes] = await Promise.allSettled([
        getPullRequestFiles(owner, repo, prNumber),
        getPullRequests(owner, repo, { state: 'all', page: 1, limit: 1 })
      ])
      if (filesRes.status === 'fulfilled') {
        const files = filesRes.value.data || filesRes.value
        if (Array.isArray(files)) {
          currentMR.value.files = files.map(f => ({
            path: f.filename || f.path, status: f.status || 'modified',
            additions: f.additions || 0, deletions: f.deletions || 0
          }))
          currentMR.value.additions = files.reduce((sum, f) => sum + (f.additions || 0), 0)
          currentMR.value.deletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0)
          currentMR.value.fileChanges = files.length
        }
      }
      // 检查 Gitea PR 是否已合并
      if (prDetailRes.status === 'fulfilled') {
        const prs = prDetailRes.value.data || prDetailRes.value || []
        const pr = Array.isArray(prs) ? prs.find(p => (p.number || p.id) === prNumber) : null
        if (pr) {
          currentMR.value._giteaMerged = pr.merged || pr.state === 'merged' || false
          if (pr.merged && currentMR.value.status === 'approved') {
            currentMR.value.status = 'merged'
          }
        }
      }
    } catch { /* fallback */ }
  }
  prDiffLoading.value = false
}

function showApprovalDialog() {
  // 重置审批表单
  approvalForm.status = 'approved'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

async function submitApproval() {
  if (!currentMR.value) {
    ElMessage.warning('请先选择一个合并请求')
    return
  }

  // 使用 MR 自身存储的 owner/repo，更可靠
  const owner = currentMR.value.owner
  const repo = currentMR.value.repo
  if (!owner || !repo) { ElMessage.error('仓库信息不完整，请刷新页面后重试'); return }

  if (!approvalForm.comment || approvalForm.comment.trim() === '') { ElMessage.warning('请填写审批意见'); return }

  // 有效的 Gitea PR 编号（整数 > 0），用于 Gitea API 调用
  const giteaPrNumber = currentMR.value.giteaPrNumber
  const isValidGiteaPr = Number.isInteger(giteaPrNumber) && giteaPrNumber > 0

  submittingApproval.value = true
  try {
    // ===== 第1步：先更新 BFF 审批状态（权威数据源） =====
    let bffResult = null
    if (currentMR.value.bffApprovalId) {
      const bffAction = approvalForm.status === 'approved' ? 'approved' : 'rejected'
      const bffRes = await processApproval(currentMR.value.bffApprovalId, {
        action: bffAction,
        body: approvalForm.comment.trim()
      })
      bffResult = bffRes.data || bffRes
    }

    // ===== 第2步：同步 Gitea 审批（非致命，失败不影响 BFF 状态） =====
    if (isValidGiteaPr) {
      try {
        const event = approvalForm.status === 'approved' ? 'APPROVE' : 'REJECT'
        await submitPullRequestReview(owner, repo, giteaPrNumber, {
          event,
          body: approvalForm.comment.trim()
        })
      } catch (giteaErr) {
        console.warn('Gitea 审批同步失败（BFF 已更新，不影响审批流程）:', giteaErr?.response?.status, giteaErr?.message)
      }
    }

    // ===== 第3步：判断审批是否全部完成 =====
    // BFF 响应格式:
    //   中间步骤: { code, message, data: { nextStep, totalSteps } }
    //   最后步骤: { code, message }（无 data 字段）
    const bffData = bffResult?.data || bffResult || {}
    const isFullyApproved = approvalForm.status === 'approved' && (
      !bffResult ||                                   // 无 BFF 关联，按单步处理
      !bffData.nextStep ||                            // 无下一步，表示已完成全部步骤
      (bffData.nextStep > bffData.totalSteps)         // 下一步超出总步数
    )

    if (approvalForm.status === 'rejected') {
      ElMessage.success('审批已拒绝')
    } else if (isFullyApproved) {
      ElMessage.success('审批已全部通过')
    } else {
      const stepName = bffData.nextStep ? `第 ${bffData.nextStep - 1} 步` : ''
      ElMessage.success(`审批${stepName}通过，等待下一步审批`)
    }

    // ===== 第4步：更新本地状态 =====
    const newStatus = approvalForm.status === 'rejected' ? 'rejected'
                    : isFullyApproved ? 'approved'
                    : 'pending'
    if (currentMR.value) {
      currentMR.value.status = newStatus
      currentMR.value.userApproval = newStatus
    }
    // 同步更新 mergeRequestList 中的对应项
    const idx = mergeRequestList.value.findIndex(m => m.id === currentMR.value.id)
    if (idx !== -1) {
      mergeRequestList.value[idx].status = newStatus
      mergeRequestList.value[idx].userApproval = newStatus
      // 更新审批进度
      if (bffData.totalSteps) {
        mergeRequestList.value[idx].requiredApprovals = bffData.totalSteps
        if (newStatus === 'pending' && bffData.nextStep) {
          mergeRequestList.value[idx].approvals = bffData.nextStep - 1
          mergeRequestList.value[idx].approvalRate = Math.round(((bffData.nextStep - 1) / bffData.totalSteps) * 100)
        } else if (newStatus === 'approved') {
          mergeRequestList.value[idx].approvals = bffData.totalSteps
          mergeRequestList.value[idx].approvalRate = 100
        }
      }
    }
    approvalDialogVisible.value = false

    // ===== 第5步：审批拒绝 → 关闭 Gitea PR =====
    if (newStatus === 'rejected' && currentMR.value && isValidGiteaPr) {
      try {
        await closePullRequest(owner, repo, giteaPrNumber)
        currentMR.value.status = 'closed'
        const mi = mergeRequestList.value.findIndex(m => m.id === currentMR.value.id)
        if (mi !== -1) mergeRequestList.value[mi].status = 'closed'
      } catch { /* ignore */ }
    }

    // ===== 第6步：审批全部通过 → 自动合并 Gitea PR =====
    if (isFullyApproved && currentMR.value && isValidGiteaPr) {
      try {
        await mergePullRequest(owner, repo, giteaPrNumber)
        currentMR.value.status = 'merged'
        currentMR.value._giteaMerged = true
        const mi = mergeRequestList.value.findIndex(m => m.id === currentMR.value.id)
        if (mi !== -1) mergeRequestList.value[mi].status = 'merged'
        ElMessage.success('审批全部通过，已自动合并')
      } catch (mergeErr) {
        console.warn('自动合并失败:', mergeErr)
        const errMsg = mergeErr?.response?.data?.message || mergeErr?.message || '未知错误'
        ElMessage.warning('审批通过，但自动合并失败: ' + errMsg + '，请手动点击合并按钮')
      }
    }

    detailDialogVisible.value = false
  } catch (error) {
    console.error('审批失败:', error)
    const detail = error?.response?.data
    const msg = typeof detail === 'string' ? detail : (detail?.message || detail?.error || '')
    ElMessage.error(msg ? `审批失败: ${msg}` : '审批提交失败，请检查网络连接')
  } finally {
    submittingApproval.value = false
  }
}

function handleApprove(row) {
  currentMR.value = row
  showApprovalDialog()
}

async function handleWithdraw(row) {
  try {
    if (row.bffApprovalId) {
      await withdrawApproval(row.bffApprovalId)
    }
    // 关闭 Gitea PR（如果有关联）
    const owner = row.owner
    const repo = row.repo
    const prNumber = row.giteaPrNumber
    if (owner && repo && prNumber) {
      try {
        await closePullRequest(owner, repo, prNumber)
      } catch { /* 忽略 */ }
    }
    ElMessage.success('合并请求已撤回')
    loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '撤回失败')
  }
}

async function handleClose(row) {
  try {
    const owner = row.owner
    const repo = row.repo
    const prNumber = row.giteaPrNumber
    if (owner && repo && prNumber) {
      await closePullRequest(owner, repo, prNumber)
    }
    ElMessage.success('合并请求已关闭')
    loadData()
  } catch (error) {
    ElMessage.warning('关闭合并请求失败')
  }
}

async function handleMerge() {
  if (!currentMR.value) return
  const owner = currentMR.value.owner
  const repo = currentMR.value.repo
  const prNumber = currentMR.value.giteaPrNumber
  if (!owner || !repo || !prNumber) { ElMessage.warning('仓库信息不完整或缺少 Gitea PR 编号'); return }
  try {
    await mergePullRequest(owner, repo, prNumber)
    ElMessage.success('合并成功')
    // 更新本地状态
    currentMR.value.status = 'merged'
    currentMR.value._giteaMerged = true
    const idx = mergeRequestList.value.findIndex(m => m.id === currentMR.value.id)
    if (idx !== -1) mergeRequestList.value[idx].status = 'merged'
    detailDialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.warning('合并失败: ' + (error?.response?.data?.message || error?.message || '未知错误'))
  }
}

function getStatusType(status) {
  const map = { 'pending': 'warning', 'approved': 'success', 'rejected': 'danger', 'merged': 'primary', 'closed': 'info' }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = { 'pending': '待审批', 'approved': '已通过', 'rejected': '已拒绝', 'merged': '已合并', 'closed': '已关闭' }
  return map[status] || status
}

function getProgressColor(percentage) {
  if (percentage >= 100) return '#67c23a'
  if (percentage >= 50) return '#e6a23c'
  return '#909399'
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.diff-stats-bar { padding:8px 12px;background:#f5f7fa;border-radius:4px;margin-bottom:12px;display:flex;gap:16px;font-weight:bold;.added{color:#67c23a}.removed{color:#f56c6c}.files{color:#909399} }
.diff-file-table { border:1px solid #ebeef5;border-radius:4px;overflow:hidden; }
.diff-table-header { display:flex;padding:8px 12px;background:#f5f7fa;font-weight:bold;font-size:13px;color:#606266; }
.diff-table-row { display:flex;padding:8px 12px;border-top:1px solid #ebeef5;font-size:13px;align-items:center;&:hover{background:#f5f7fa} }
.col-status { width:80px;flex-shrink:0; }
.col-path { flex:1;word-break:break-all; }
.col-stats { width:100px;flex-shrink:0;text-align:right;white-space:nowrap; }
.filter-card {
  margin-bottom: 20px;
}

.mr-id {
  color: #409eff;
  font-weight: 600;
}

.mr-title {
  cursor: pointer;
  color: #303133;
  font-weight: 500;
  
  &:hover {
    color: #409eff;
  }
}

.mr-branches {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  
  .arrow {
    color: #909399;
  }
}

.approval-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .el-progress {
    width: 80px;
  }
  
  .approval-text {
    font-size: 12px;
    color: #909399;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.mr-detail {
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    h3 {
      margin: 0;
    }
  }
  
  .detail-info {
    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      
      .label {
        color: #909399;
        width: 80px;
      }
      
      .arrow {
        color: #909399;
      }
    }
  }
}

.diff-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  
  .stat {
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 13px;
    
    &.added {
      background: #e6ffec;
      color: #22863a;
    }
    
    &.removed {
      background: #ffebe9;
      color: #cb2431;
    }
    
    &.files {
      background: #f6f8fa;
      color: #586069;
    }
  }
}

.file-changes {
  .file-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-bottom: 1px solid #ebeef5;
    
    .file-status {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
      
      &.added { background: #e6ffec; color: #22863a; }
      &.modified { background: #fff5b1; color: #d29922; }
      &.deleted { background: #ffebe9; color: #cb2431; }
    }
    
    .file-path {
      font-family: monospace;
      font-size: 13px;
    }
  }
}

.approval-records {
  .record-item {
    display: flex;
    gap: 15px;
    padding: 15px;
    border-bottom: 1px solid #ebeef5;
    
    .record-content {
      flex: 1;
      
      .record-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 5px;
        
        .reviewer {
          font-weight: 500;
        }
      }
      
      .record-comment {
        color: #606266;
        margin-bottom: 5px;
      }
      
      .record-time {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}
</style>
