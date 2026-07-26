<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title"><el-icon><DocumentChecked /></el-icon> 待我审批</h2>
      <el-badge :value="pendingCount" :hidden="pendingCount === 0">
        <span class="pending-tip">共 {{ pendingCount }} 条待审批</span>
      </el-badge>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="审批类型">
          <el-select v-model="filterForm.type" placeholder="选择类型" clearable style="width: 150px">
            <el-option label="合并请求" value="merge" />
            <el-option label="版本发布" value="version_release" />
            <el-option label="基线申请" value="baseline_create" />
            <el-option label="基线变更" value="baseline_change" />
            <el-option label="基线冻结" value="baseline_freeze" />
            <el-option label="基线归档" value="baseline_archive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="table-responsive">
      <el-table :data="pendingList" v-loading="loading" stripe border @row-contextmenu.prevent="openMenu">
      <el-table-column type="index" width="50" label="序号" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getTypeTagType(row.operation_type)" size="small">
            {{ getTypeName(row.operation_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标题" min-width="200">
        <template #default="{ row }">
          <div class="approval-title" @click="viewDetail(row)">{{ row.title }}</div>
          <div class="approval-info">
            <span>申请人：{{ row.applicant_username }}</span>
            <span>·</span>
            <span>{{ formatTime(row.created_at) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="紧急程度" width="100">
        <template #default="{ row }">
          <el-tag :type="getUrgencyType(row.urgency)" size="small">
            {{ getUrgencyName(row.urgency) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
            <el-button type="success" size="small" @click="handleApprove(row)">通过</el-button>
            <el-button type="danger" size="small" @click="handleReject(row)">拒绝</el-button>
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
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadPending"
        @current-change="loadPending"
      />
    </div>

    <!-- 审批详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="审批详情" width="700px">
      <div class="approval-detail" v-if="currentApproval">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请类型">{{ getTypeName(currentApproval.operation_type) }}</el-descriptions-item>
          <el-descriptions-item label="紧急程度">{{ getUrgencyName(currentApproval.urgency) }}</el-descriptions-item>
          <el-descriptions-item label="申请人" :span="2">{{ currentApproval.applicant_username }}</el-descriptions-item>
          <el-descriptions-item label="申请时间" :span="2">{{ formatTime(currentApproval.created_at) }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">申请内容</el-divider>
        <div class="detail-content">
          <h4>{{ currentApproval.title }}</h4>
          <p>{{ currentApproval.description || '无描述' }}</p>
        </div>
        <el-divider content-position="left">操作说明</el-divider>
        <div class="operation-info">
          <p v-if="currentApproval.source_branch">源分支：<el-tag size="small">{{ currentApproval.source_branch }}</el-tag></p>
          <p v-if="currentApproval.target_branch">目标分支：<el-tag size="small" type="primary">{{ currentApproval.target_branch }}</el-tag></p>
          <p v-if="currentApproval.repo_name">仓库：{{ currentApproval.repo_owner }}/{{ currentApproval.repo_name }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="danger" @click="handleReject">拒绝</el-button>
        <el-button type="success" @click="handleApprove">通过</el-button>
      </template>
    </el-dialog>

    <!-- 审批意见弹窗 -->
    <el-dialog v-model="approvalDialogVisible" title="审批意见" width="500px">
      <el-form :model="approvalForm" label-width="80px">
        <el-form-item label="审批结果">
          <el-radio-group v-model="approvalForm.result">
            <el-radio label="approved">通过</el-radio>
            <el-radio label="rejected">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input v-model="approvalForm.comment" type="textarea" :rows="4" placeholder="请输入审批意见（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApproval">提交审批</el-button>
      </template>
    </el-dialog>

    <RowContextMenu :visible="visible" :position="position" :actions="menuRow ? getActions(menuRow) : []" @close="closeMenu" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { DocumentChecked, MoreFilled, View, Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getPendingApprovals, getApprovalDetail, processApproval } from '@/api/approval'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'

const loading = ref(false)
const detailDialogVisible = ref(false)
const approvalDialogVisible = ref(false)

const pendingList = ref([])
const currentApproval = ref(null)
const pendingCount = computed(() => pendingList.value.length)

const filterForm = reactive({
  type: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const approvalForm = reactive({
  result: 'approved',
  comment: ''
})

const { visible, position, currentRow: menuRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '详情', icon: View, onClick: () => viewDetail(row) },
    { label: '通过', icon: Check, type: 'success', onClick: () => handleApprove(row) },
    { label: '拒绝', icon: Close, type: 'danger', divided: true, onClick: () => handleReject(row) }
  ]
}

function onTrigger(row, event) {
  openMenu(row, event)
}

onMounted(() => {
  loadPending()
})

async function loadPending() {
  loading.value = true
  try {
    const res = await getPendingApprovals({
      page: pagination.page,
      pageSize: pagination.pageSize,
      type: filterForm.type || undefined
    })
    pendingList.value = res.data?.list || res.data || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载待审批列表失败:', error)
    ElMessage.error('加载待审批列表失败，请重新登录')
    pendingList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  pagination.page = 1
  loadPending()
}

function resetFilter() {
  filterForm.type = ''
  handleFilter()
}

async function viewDetail(row) {
  try {
    const res = await getApprovalDetail(row.approval_id)
    currentApproval.value = res.data
  } catch (error) {
    currentApproval.value = { ...row }
  }
  detailDialogVisible.value = true
}

function handleApprove(row) {
  if (row && row.approval_id) currentApproval.value = row
  approvalForm.result = 'approved'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

function handleReject(row) {
  if (row && row.approval_id) currentApproval.value = row
  approvalForm.result = 'rejected'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

async function submitApproval() {
  if (!currentApproval.value) return
  
  // 审批意见不能为空
  if (!approvalForm.comment || approvalForm.comment.trim() === '') {
    ElMessage.warning('请填写审批意见')
    return
  }
  
  try {
    const action = approvalForm.result === 'approved' ? 'approved' : 'rejected'
    const res = await processApproval(currentApproval.value.approval_id, {
      action,
      body: approvalForm.comment.trim()
    })
    
    ElMessage.success(approvalForm.result === 'approved' ? '审批已通过' : '审批已拒绝')
    approvalDialogVisible.value = false
    detailDialogVisible.value = false
    
    // 审批成功后，从列表中移除该记录（因为已经处理过了）
    const index = pendingList.value.findIndex(p => p.approval_id === currentApproval.value.approval_id)
    if (index !== -1) {
      loadPending()
    }
  } catch (error) {
    console.error('审批提交失败:', error)
    const errorMsg = error?.response?.data?.message || error?.message || '审批提交失败'
    ElMessage.error(`审批失败: ${errorMsg}`)
  }
}

function getTypeTagType(type) {
  const map = { 'merge': 'primary', 'version_release': 'success', 'baseline_create': 'warning', 'baseline_change': '', 'baseline_freeze': 'danger', 'baseline_archive': 'info' }
  return map[type] || 'info'
}

function getTypeName(type) {
  const map = { 'merge': '合并请求', 'version_release': '版本发布', 'baseline_create': '基线申请', 'baseline_change': '基线变更', 'baseline_freeze': '基线冻结', 'baseline_archive': '基线归档' }
  return map[type] || type
}

function getUrgencyType(urgency) {
  const map = { 'high': 'danger', 'normal': 'warning', 'low': 'info' }
  return map[urgency] || 'info'
}

function getUrgencyName(urgency) {
  const map = { 'high': '紧急', 'normal': '普通', 'low': '低' }
  return map[urgency] || urgency
}

function getStatusTagType(status) {
  const map = { 'pending': 'warning', 'approved': 'success', 'rejected': 'danger' }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = { 'pending': '待审批', 'approved': '已通过', 'rejected': '已拒绝' }
  return map[status] || status
}

function formatTime(time) {
  if (!time) return '-'
  if (typeof time === 'string') return time
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.pending-tip {
  color: #909399;
  font-size: 14px;
}

.approval-title {
  color: #409eff;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
}

.approval-info {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.detail-content {
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;
  
  h4 {
    margin: 0 0 10px;
    color: #333;
  }
  
  p {
    margin: 0;
    color: #606266;
    line-height: 1.6;
  }
}

.operation-info {
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
  
  p {
    margin: 5px 0;
    color: #606266;
    
    .el-tag {
      margin-left: 5px;
    }
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
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
  :deep(.action-col) {
    width: 50px !important;
    min-width: 50px !important;
  }
}
</style>
