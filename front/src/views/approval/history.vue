<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">审批历史</h2>
      <div class="button-group">
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出记录
        </el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="审批类型">
          <el-select v-model="filterForm.type" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="合并请求" value="merge" />
            <el-option label="版本发布" value="version" />
            <el-option label="基线申请" value="baseline" />
            <el-option label="分支创建" value="branch" />
          </el-select>
        </el-form-item>
        <el-form-item label="审批结果">
          <el-select v-model="filterForm.status" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已撤回" value="withdrawn" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="historyList" v-loading="loading" stripe border>
      <el-table-column type="index" width="50" />
      <el-table-column label="申请类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getTypeTagType(row.operation_type)" size="small">
            {{ getTypeName(row.operation_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标题" min-width="250">
        <template #default="{ row }">
          <div class="approval-title" @click="viewDetail(row)">{{ row.title }}</div>
          <div class="approval-repo">
            <el-icon><Folder /></el-icon>
            {{ row.repo_owner }}/{{ row.repo_name }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="申请人" width="120">
        <template #default="{ row }">
          <div class="applicant-cell">
            <el-avatar :size="24">{{ row.applicant_username?.charAt(0) || 'U' }}</el-avatar>
            <span>{{ row.applicant_username }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="审批结果" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="审批流程" width="200">
        <template #default="{ row }">
          <el-steps :active="row.current_step" size="small" finish-status="success">
            <el-step v-for="(step, index) in (row.steps || ['提交', '审核'])" :key="index" :title="step" />
          </el-steps>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="完成时间" width="160">
        <template #default="{ row }">
          {{ row.completed_at ? formatTime(row.completed_at) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        @size-change="loadHistory"
        @current-change="loadHistory"
      />
    </div>

    <el-dialog v-model="detailDialogVisible" title="审批详情" width="800px">
      <el-descriptions v-if="currentApproval" :column="2" border>
        <el-descriptions-item label="申请类型">
          <el-tag :type="getTypeTagType(currentApproval.operation_type)" size="small">
            {{ getTypeName(currentApproval.operation_type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审批状态">
          <el-tag :type="getStatusTagType(currentApproval.status)" size="small">
            {{ getStatusName(currentApproval.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="标题" :span="2">{{ currentApproval.title }}</el-descriptions-item>
        <el-descriptions-item label="仓库">{{ currentApproval.repo_owner }}/{{ currentApproval.repo_name }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ currentApproval.applicant_username }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ formatTime(currentApproval.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ currentApproval.completed_at ? formatTime(currentApproval.completed_at) : '-' }}</el-descriptions-item>
      </el-descriptions>
      
      <el-divider content-position="left">审批记录</el-divider>
      
      <el-timeline v-if="approvalRecords.length > 0">
        <el-timeline-item 
          v-for="(record, index) in approvalRecords" 
          :key="index"
          :type="record.action === 'approved' ? 'success' : 'danger'"
          :timestamp="formatTime(record.action_time)"
        >
          <h4>{{ record.step_name || `步骤 ${record.step}` }}</h4>
          <p>
            审批人: {{ record.reviewer_user_id }}
            <br/>
            操作: {{ record.action === 'approved' ? '通过' : '拒绝' }}
          </p>
          <p v-if="record.comment">意见: {{ record.comment }}</p>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无审批记录" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getApprovalList, getApprovalDetail } from '@/api/approval'

const loading = ref(false)
const detailDialogVisible = ref(false)
const currentApproval = ref(null)
const approvalRecords = ref([])

const filterForm = reactive({
  type: '',
  status: '',
  dateRange: []
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const historyList = ref([
  { approval_id: 1, operation_type: 'merge', title: '[feature/auth] 新增用户认证模块', repo_owner: 'root', repo_name: 'gov-user-service', applicant_username: '张三', status: 'approved', current_step: 2, created_at: '2024-01-15 10:00:00', completed_at: '2024-01-15 14:30:00', steps: ['提交申请', '技术审核', '审批通过'] },
  { approval_id: 2, operation_type: 'version', title: '政务系统 v2.1.0 正式版本发布', repo_owner: 'root', repo_name: 'gov-system', applicant_username: '李四', status: 'approved', current_step: 2, created_at: '2024-01-14 09:00:00', completed_at: '2024-01-14 16:00:00', steps: ['提交申请', '安全审核', '领导审批'] },
  { approval_id: 3, operation_type: 'baseline', title: '申请设置v2.0.0为基线版本', repo_owner: 'root', repo_name: 'gov-system', applicant_username: '王五', status: 'rejected', current_step: 1, created_at: '2024-01-13 11:00:00', completed_at: '2024-01-13 15:00:00', steps: ['提交申请', '技术审核'] }
])

onMounted(() => {
  loadHistory()
})

async function loadHistory() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      type: filterForm.type,
      status: filterForm.status
    }
    
    if (filterForm.dateRange?.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }
    
    // 使用模拟数据，实际应调用 API
    // const res = await getApprovalList(params)
    // historyList.value = res.data.list || []
    // pagination.total = res.data.total || 0
    
    pagination.total = historyList.value.length
  } catch (error) {
    console.error('加载审批历史失败', error)
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  pagination.page = 1
  loadHistory()
}

function resetFilter() {
  filterForm.type = ''
  filterForm.status = ''
  filterForm.dateRange = []
  handleFilter()
}

async function viewDetail(row) {
  currentApproval.value = row
  // 实际应调用 API 获取审批记录
  // const res = await getApprovalDetail(row.approval_id)
  // approvalRecords.value = res.data.approval_records || []
  approvalRecords.value = []
  detailDialogVisible.value = true
}

function handleExport() {
  ElMessage.info('导出功能开发中')
}

function getTypeTagType(type) {
  const map = { 'merge': 'primary', 'version': 'success', 'baseline': 'warning', 'branch': 'info' }
  return map[type] || 'info'
}

function getTypeName(type) {
  const map = { 'merge': '合并请求', 'version': '版本发布', 'baseline': '基线申请', 'branch': '分支创建' }
  return map[type] || type
}

function getStatusTagType(status) {
  const map = { 'pending': 'warning', 'approved': 'success', 'rejected': 'danger', 'withdrawn': 'info' }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = { 'pending': '待审批', 'approved': '已通过', 'rejected': '已拒绝', 'withdrawn': '已撤回' }
  return map[status] || status
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.approval-title {
  color: #409eff;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
}

.approval-repo {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.applicant-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
