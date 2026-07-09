<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">我的申请</h2>
      <el-button type="primary" @click="$router.push('/branches/merge')">
        <el-icon><Plus /></el-icon>
        新建申请
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="申请类型">
          <el-select v-model="filterForm.type" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="合并请求" value="merge" />
            <el-option label="版本发布" value="version" />
            <el-option label="基线申请" value="baseline" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">筛选</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="myRequests" v-loading="loading" stripe border>
      <el-table-column type="index" width="50" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getTypeTagType(row.operation_type)" size="small">
            {{ getTypeName(row.operation_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标题" min-width="250">
        <template #default="{ row }">
          <div class="request-title" @click="viewDetail(row)">{{ row.title }}</div>
          <div class="request-repo">
            <el-icon><Folder /></el-icon>
            {{ row.repo_owner }}/{{ row.repo_name }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="审批进度" width="150">
        <template #default="{ row }">
          <el-progress :percentage="getProgress(row)" :color="getProgressColor(getProgress(row))" />
        </template>
      </el-table-column>
      <el-table-column label="紧急程度" width="100">
        <template #default="{ row }">
          <el-tag :type="getUrgencyType(row.urgency)" size="small">
            {{ getUrgencyName(row.urgency) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
          <el-button type="warning" link @click="handleCancel(row)" v-if="row.status === 'pending'">撤回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadMyRequests"
      />
    </div>

    <el-dialog v-model="detailDialogVisible" title="申请详情" width="700px">
      <div v-if="currentRequest">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请类型">
            <el-tag :type="getTypeTagType(currentRequest.operation_type)" size="small">
              {{ getTypeName(currentRequest.operation_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(currentRequest.status)" size="small">
              {{ getStatusName(currentRequest.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ currentRequest.title }}</el-descriptions-item>
          <el-descriptions-item label="仓库" :span="2">{{ currentRequest.repo_owner }}/{{ currentRequest.repo_name }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ formatTime(currentRequest.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="紧急程度">
            <el-tag :type="getUrgencyType(currentRequest.urgency)" size="small">
              {{ getUrgencyName(currentRequest.urgency) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        
        <el-divider content-position="left">申请说明</el-divider>
        <div class="request-description">
          {{ currentRequest.description || '无' }}
        </div>
        
        <el-divider content-position="left">审批进度</el-divider>
        <el-steps :active="currentRequest.current_step" finish-status="success" align-center>
          <el-step v-for="(step, index) in (currentRequest.steps || ['提交申请', '技术审核', '审批通过'])" :key="index" :title="step" />
        </el-steps>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMyApprovals } from '@/api/approval'

const loading = ref(false)
const detailDialogVisible = ref(false)
const currentRequest = ref(null)

const filterForm = reactive({
  type: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const myRequests = ref([
  { approval_id: 1, operation_type: 'merge', title: '[feature/auth] 新增用户认证功能', repo_owner: 'root', repo_name: 'gov-user-service', status: 'pending', current_step: 1, urgency: 'normal', created_at: '2024-01-15 10:00:00', steps: ['提交申请', '技术审核', '审批通过'] },
  { approval_id: 2, operation_type: 'version', title: '政务系统 v1.2.0 正式发布', repo_owner: 'root', repo_name: 'gov-system', status: 'approved', current_step: 3, urgency: 'high', created_at: '2024-01-14 15:00:00', steps: ['提交申请', '安全审核', '领导审批'] },
  { approval_id: 3, operation_type: 'baseline', title: '申请设置v1.0.0为基线', repo_owner: 'root', repo_name: 'gov-system', status: 'rejected', current_step: 1, urgency: 'normal', created_at: '2024-01-13 09:00:00', description: '该版本已通过全部测试，可以设为基线', steps: ['提交申请', '技术审核'] }
])

onMounted(() => {
  loadMyRequests()
})

async function loadMyRequests() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      type: filterForm.type,
      status: filterForm.status,
      applicantUserId: 'me'
    }
    
    const res = await getMyApprovals(params)
    myRequests.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch (error) {
    console.error('加载我的申请失败', error)
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  pagination.page = 1
  loadMyRequests()
}

function resetFilter() {
  filterForm.type = ''
  filterForm.status = ''
  handleFilter()
}

function viewDetail(row) {
  currentRequest.value = row
  detailDialogVisible.value = true
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm('确定要撤回该申请吗？', '撤回申请', { type: 'warning' })
    ElMessage.success('申请已撤回')
    loadMyRequests()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('撤回失败')
    }
  }
}

function getProgress(row) {
  const steps = row.steps?.length || 3
  return Math.round((row.current_step / steps) * 100)
}

function getProgressColor(progress) {
  if (progress >= 100) return '#67c23a'
  if (progress >= 50) return '#e6a23c'
  return '#909399'
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

function getUrgencyType(urgency) {
  const map = { 'high': 'danger', 'normal': 'warning', 'low': 'info' }
  return map[urgency] || 'info'
}

function getUrgencyName(urgency) {
  const map = { 'high': '紧急', 'normal': '普通', 'low': '低' }
  return map[urgency] || urgency
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.request-title {
  color: #409eff;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
}

.request-repo {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.request-description {
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;
  line-height: 1.6;
  color: #606266;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
