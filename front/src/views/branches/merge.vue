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
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.name" :value="repo.id" />
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
          <span class="mr-id">#{{ row.id }}</span>
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
          <el-button type="success" link @click="handleApprove(row)" v-if="row.status === 'pending'">审批</el-button>
          <el-button type="danger" link @click="handleClose(row)" v-if="row.status === 'pending'">关闭</el-button>
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
        <el-form-item label="源仓库" prop="sourceRepoId" class="form-required">
          <el-select v-model="createForm.sourceRepoId" placeholder="选择源仓库" @change="loadSourceBranches">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.name" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="源分支" prop="sourceBranch" class="form-required">
          <el-select v-model="createForm.sourceBranch" placeholder="选择源分支">
            <el-option v-for="branch in sourceBranches" :key="branch" :label="branch" :value="branch" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标仓库" prop="targetRepoId" class="form-required">
          <el-select v-model="createForm.targetRepoId" placeholder="选择目标仓库" @change="loadTargetBranches">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.name" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标分支" prop="targetBranch" class="form-required">
          <el-select v-model="createForm.targetBranch" placeholder="选择目标分支">
            <el-option v-for="branch in targetBranches" :key="branch" :label="branch" :value="branch" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联审批流程">
          <el-select v-model="createForm.approvalFlowId" placeholder="选择审批流程" clearable>
            <el-option v-for="flow in approvalFlows" :key="flow.id" :label="flow.name" :value="flow.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="指派审批人">
          <el-select v-model="createForm.reviewers" multiple placeholder="选择审批人">
            <el-option v-for="user in reviewerOptions" :key="user.value" :label="user.label" :value="user.value" />
          </el-select>
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
        <div style="text-align:center;padding:20px">
          <p style="color:#909399;margin-bottom:12px">Gitea 1.21 API 不支持返回 PR 差异详情</p>
          <el-button type="primary" @click="openGiteaPR(currentMR)">
            <el-icon><Link /></el-icon> 在 Gitea 中查看完整差异
          </el-button>
        </div>

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
        <el-button @click="showApprovalDialog" type="primary" v-if="currentMR?.status === 'pending' || currentMR?.status === 'open'">审批</el-button>
        <el-button type="success" @click="handleMerge" v-if="currentMR?.status === 'approved'">合并</el-button>
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
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Link } from '@element-plus/icons-vue'
import { getPullRequests, getMyRepos, getBranches, createPullRequest, mergePullRequest, closePullRequest, getPullRequestFiles, submitPullRequestReview } from '@/api/gitea'
import { getApprovalFlows, createApproval, processApproval } from '@/api/bff'
import { getUserList } from '@/api/user'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const submittingApproval = ref(false)
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const approvalDialogVisible = ref(false)

const filterForm = reactive({
  status: 'pending',
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
    createDialogVisible.value = true
  }
  await loadRepos()
  loadData()
  loadApprovalFlows()
  loadReviewers()
})

async function loadRepos() {
  try {
    const res = await getMyRepos()
    const repos = res.data || res
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
    let list = []
    // Iterate repos to load PRs from Gitea API
    const repos = filterForm.repoId
      ? repoList.value.filter(r => r.id === filterForm.repoId)
      : repoList.value
    for (const repo of repos) {
      try {
        const prRes = await getPullRequests(repo.owner, repo.repo, { state: 'all', page: 1, limit: 10 })
        const prs = prRes.data || prRes
        if (Array.isArray(prs)) {
          // 获取每个 PR 的审批状态
          for (const pr of prs) {
            let approvals = []
            let hasUserApproved = false
            let hasUserRejected = false
            let requiredApprovals = 1 // 默认需要1人审批
            
            // 尝试获取审批记录
            try {
              const reviewRes = await getPullRequestReviews(repo.owner, repo.repo, pr.id || pr.number)
              const reviews = reviewRes.data || reviewRes || []
              approvals = Array.isArray(reviews) ? reviews : []
              // 检查当前用户是否已审批
              for (const review of approvals) {
                if (review.user?.login === userStore.userInfo?.login || review.user?.username === userStore.userInfo?.username) {
                  if (review.state === 'APPROVED' || review.state === 'PENDING') hasUserApproved = true
                  if (review.state === 'REJECTED') hasUserRejected = true
                }
              }
            } catch {
              // 获取审批记录失败，使用默认值
            }
            
            // 计算审批进度
            const approvedCount = approvals.filter(r => r.state === 'APPROVED').length
            const rejected = approvals.some(r => r.state === 'REJECTED')
            const approvalRate = Math.min(100, Math.round((approvedCount / requiredApprovals) * 100)) || 50
            
            // 确定显示状态（优先使用 Gitea PR 自身状态）
            let displayStatus = 'pending'
            if (pr.merged || pr.state === 'merged') {
              displayStatus = 'merged'
            } else if (pr.state === 'closed') {
              displayStatus = 'closed'
            } else if (rejected || hasUserRejected) {
              displayStatus = 'rejected'
            } else if (hasUserApproved) {
              displayStatus = 'approved'
            } else if (pr.state === 'open') {
              displayStatus = 'open'
            }
            
            // 状态筛选
            if (filterForm.status && filterForm.status !== displayStatus) {
              continue
            }
            
            list.push({
              id: pr.id || pr.number,
              title: pr.title,
              sourceBranch: pr.head?.label || pr.head?.ref || '',
              targetBranch: pr.base?.label || pr.base?.ref || '',
              repoId: repo.id,
              repoName: repo.name,
              // Gitea API 状态
              state: pr.state,
              merged: pr.merged,
              // 显示状态（考虑用户审批情况）
              status: displayStatus,
              // 用户审批状态
              userApproval: hasUserApproved ? 'approved' : hasUserRejected ? 'rejected' : null,
              approvals: approvedCount,
              requiredApprovals,
              approvalRate,
              author: pr.user?.username || pr.user?.login || '',
              createdAt: pr.created_at || pr.createdAt,
              additions: 0,
              deletions: 0,
              fileChanges: 0,
              files: [],
              approvalRecords: approvals,
              owner: repo.owner,
              repo: repo.repo
            })
          }
        }
      } catch {
        // Skip repos that fail
      }
    }

    mergeRequestList.value = list
    pagination.total = list.length
  } catch (error) {
    console.error('加载合并请求列表失败:', error)
    ElMessage.warning('加载合并请求列表失败')
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
  if (!sourceRepo || !targetRepo) {
    ElMessage.warning('请选择仓库')
    return
  }
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
        id: prNumber,
        number: prNumber,
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
    ElMessage.warning('创建合并请求失败: ' + (error?.message || '未知错误'))
  }
}

async function viewDetail(row) {
  currentMR.value = { ...row }
  detailDialogVisible.value = true
  // Try to load PR files
  const repo = repoList.value.find(r => r.id === row.repoId)
  if (repo && (row.id || row.number)) {
    try {
      const res = await getPullRequestFiles(repo.owner, repo.repo, row.id || row.number)
      const files = res.data || res
      if (Array.isArray(files)) {
        currentMR.value.files = files.map(f => ({
          path: f.filename || f.path,
          status: f.status || 'modified'
        }))
        currentMR.value.additions = files.reduce((sum, f) => sum + (f.additions || 0), 0)
        currentMR.value.deletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0)
        currentMR.value.fileChanges = files.length
      }
    } catch {
      // Fallback to existing data
    }
  }
}

function openGiteaPR(mr) {
  const repo = repoList.value.find(r => r.id === mr.repoId)
  const owner = repo?.owner || ''
  const repoName = repo?.repo || ''
  const prId = mr.id || mr.number
  if (owner && repoName && prId) {
    window.open(`http://123.60.219.19:3000/${owner}/${repoName}/pulls/${prId}`, '_blank')
  }
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
  
  // 检查必要的仓库信息
  const repo = repoList.value.find(r => r.id === currentMR.value.repoId)
  if (!repo) {
    ElMessage.warning('无法确定仓库信息')
    return
  }
  
  const prId = currentMR.value.id || currentMR.value.number
  if (!prId) {
    ElMessage.warning('无法确定合并请求编号')
    return
  }
  
  // 审批意见不能为空
  if (!approvalForm.comment || approvalForm.comment.trim() === '') {
    ElMessage.warning('请填写审批意见')
    return
  }
  
  submittingApproval.value = true
  try {
    // 调用 Gitea API 提交 PR 审批
    // event: APPROVE (通过), REJECT (拒绝), COMMENT (仅评论)
    const event = approvalForm.status === 'approved' ? 'APPROVE' : 'REJECT'
    
    console.log('提交审批:', {
      owner: repo.owner,
      repo: repo.repo,
      prId,
      event,
      body: approvalForm.comment.trim()
    })
    
    await submitPullRequestReview(repo.owner, repo.repo, prId, {
      event,
      body: approvalForm.comment.trim()
    })
    
    // 审批成功后，同步更新 BFF 数据库中的审批记录
    // 查找对应的 BFF 审批记录
    try {
      // 尝试通过标题匹配找到对应的审批记录
      const bffAction = approvalForm.status === 'approved' ? 'approved' : 'rejected'
      await processApproval(currentMR.value.bffApprovalId || prId, {
        action: bffAction,
        body: approvalForm.comment.trim()
      })
    } catch (bffError) {
      console.warn('同步更新 BFF 审批状态失败:', bffError)
      // 即使 BFF 更新失败，也不影响 Gitea 审批结果
    }
    
    ElMessage.success(approvalForm.status === 'approved' ? '审批已通过' : '审批已拒绝')
    // 立即更新本地状态
    const newStatus = approvalForm.status === 'approved' ? 'approved' : 'rejected'
    if (currentMR.value) {
      currentMR.value.status = newStatus
      currentMR.value.userApproval = newStatus
    }
    approvalDialogVisible.value = false
    detailDialogVisible.value = false

    // 刷新列表确保同步
    loadData()
  } catch (error) {
    console.error('审批失败:', error)
    // 显示具体的错误信息
    const errorMsg = error?.response?.data?.message || error?.message || '审批提交失败'
    ElMessage.error(`审批失败: ${errorMsg}`)
  } finally {
    submittingApproval.value = false
  }
}

function handleApprove(row) {
  currentMR.value = row
  showApprovalDialog()
}

async function handleClose(row) {
  try {
    const repo = repoList.value.find(r => r.id === row.repoId)
    if (repo) {
      await closePullRequest(repo.owner, repo.repo, row.id || row.number)
    }
    ElMessage.success('合并请求已关闭')
    loadData()
  } catch (error) {
    ElMessage.warning('关闭合并请求失败')
  }
}

async function handleMerge() {
  if (!currentMR.value) return
  try {
    const repo = repoList.value.find(r => r.id === currentMR.value.repoId)
    if (repo) {
      await mergePullRequest(repo.owner, repo.repo, currentMR.value.id || currentMR.value.number)
    }
    ElMessage.success('合并成功')
    detailDialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.warning('合并失败')
  }
}

function getStatusType(status) {
  const map = { 'pending': 'warning', 'approved': 'success', 'rejected': 'danger', 'merged': 'primary', 'closed': 'info' }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = { 'pending': '待审批', 'open': '开放中', 'approved': '已通过', 'rejected': '已拒绝', 'merged': '已合并', 'closed': '已关闭' }
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
