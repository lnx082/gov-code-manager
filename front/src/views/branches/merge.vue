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
            <el-option label="标准流程" value="1" />
            <el-option label="涉密版本流程" value="2" />
            <el-option label="紧急修复流程" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="指派审批人">
          <el-select v-model="createForm.reviewers" multiple placeholder="选择审批人">
            <el-option label="张三" value="zhangsan" />
            <el-option label="李四" value="lisi" />
            <el-option label="王五" value="wangwu" />
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
        
        <div class="diff-stats">
          <span class="stat added">+ {{ currentMR.additions }} 行</span>
          <span class="stat removed">- {{ currentMR.deletions }} 行</span>
          <span class="stat files">{{ currentMR.fileChanges }} 个文件</span>
        </div>

        <el-tabs>
          <el-tab-pane label="文件变更">
            <div class="file-changes">
              <div v-for="file in currentMR.files" :key="file.path" class="file-item">
                <span class="file-status" :class="file.status">{{ file.status }}</span>
                <span class="file-path">{{ file.path }}</span>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="评论">
            <div class="comments">
              <el-empty description="暂无评论" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="审批记录">
            <div class="approval-records">
              <div v-for="record in currentMR.approvalRecords" :key="record.id" class="record-item">
                <el-avatar :size="32">{{ record.reviewer.charAt(0) }}</el-avatar>
                <div class="record-content">
                  <div class="record-header">
                    <span class="reviewer">{{ record.reviewer }}</span>
                    <el-tag :type="record.status === 'approved' ? 'success' : 'danger'" size="small">
                      {{ record.status === 'approved' ? '通过' : '拒绝' }}
                    </el-tag>
                  </div>
                  <div class="record-comment">{{ record.comment || '无评论' }}</div>
                  <div class="record-time">{{ formatTime(record.time) }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button @click="showApprovalDialog" type="primary">审批</el-button>
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
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApproval">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()

const loading = ref(false)
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

const mergeRequestList = ref([
  { id: 1, title: '[feature/user-auth] 新增用户认证模块', sourceBranch: 'feature/user-auth', targetBranch: 'develop', repoId: 1, repoName: '政务系统-用户模块', status: 'pending', approvals: 1, requiredApprovals: 2, approvalRate: 50, author: '张三', createdAt: '2024-01-15 10:00', additions: 150, deletions: 20, fileChanges: 8, files: [{ path: 'src/auth/login.js', status: 'modified' }], approvalRecords: [] },
  { id: 2, title: '[bugfix/login] 修复登录页面样式异常', sourceBranch: 'bugfix/login', targetBranch: 'main', repoId: 1, repoName: '政务系统-用户模块', status: 'approved', approvals: 2, requiredApprovals: 2, approvalRate: 100, author: '李四', createdAt: '2024-01-14 15:00', additions: 5, deletions: 3, fileChanges: 1, files: [], approvalRecords: [] }
])

const repoList = ref([
  { id: 1, name: '政务系统-用户模块' },
  { id: 2, name: '政务系统-审批模块' }
])

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

const sourceBranches = ref(['develop', 'feature/user-auth', 'bugfix/login'])
const targetBranches = ref(['main', 'develop'])

const approvalForm = reactive({
  status: 'approved',
  comment: ''
})

onMounted(() => {
  if (route.query.source) {
    createForm.sourceBranch = route.query.source
    createDialogVisible.value = true
  }
  loadData()
})

function loadData() {
  loading.value = true
  setTimeout(() => {
    pagination.total = mergeRequestList.value.length
    loading.value = false
  }, 300)
}

function handleFilter() {
  loadData()
}

function showCreateDialog() {
  createDialogVisible.value = true
}

function loadSourceBranches() {
  sourceBranches.value = ['develop', 'feature/new', 'bugfix/issue']
}

function loadTargetBranches() {
  targetBranches.value = ['main', 'develop', 'test']
}

async function handleCreate() {
  ElMessage.success('合并请求创建成功')
  createDialogVisible.value = false
  loadData()
}

function viewDetail(row) {
  currentMR.value = row
  detailDialogVisible.value = true
}

function showApprovalDialog() {
  approvalDialogVisible.value = true
}

async function submitApproval() {
  ElMessage.success('审批提交成功')
  approvalDialogVisible.value = false
  detailDialogVisible.value = false
  loadData()
}

function handleApprove(row) {
  currentMR.value = row
  showApprovalDialog()
}

function handleClose(row) {
  ElMessage.warning('关闭合并请求功能开发中')
}

function handleMerge() {
  ElMessage.success('合并成功')
  detailDialogVisible.value = false
  loadData()
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
