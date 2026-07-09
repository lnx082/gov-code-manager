<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">基线管理</h2>
      <div class="button-group">
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          新建基线
        </el-button>
      </div>
    </div>

    <el-alert type="info" :closable="false" class="info-alert">
      <template #title>
        <strong>基线说明：</strong>基线是经过评审确认、固化锁定的正式软件版本。它是上线、运维、迭代的唯一标准版本，基线变更必须履行正式审批流程。
      </template>
    </el-alert>

    <el-table :data="baselineList" v-loading="loading" stripe border class="baseline-table">
      <el-table-column label="基线名称" width="200">
        <template #default="{ row }">
          <div class="baseline-cell">
            <el-icon><Lock /></el-icon>
            <span class="baseline-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="对应版本" width="120" />
      <el-table-column prop="repoName" label="所属仓库" width="180" />
      <el-table-column prop="description" label="基线说明" min-width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status === 'active' ? '激活' : '归档' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="创建者" width="100" />
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
          <el-button type="primary" link @click="handleChange(row)" v-if="row.status === 'active'">变更</el-button>
          <el-button type="danger" link @click="handleFreeze(row)" v-if="row.status === 'active'">冻结</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createDialogVisible" title="创建基线" width="600px">
      <el-form :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="基线名称" prop="name" class="form-required">
          <el-input v-model="createForm.name" placeholder="请输入基线名称" />
        </el-form-item>
        <el-form-item label="选择版本" prop="versionId" class="form-required">
          <el-select v-model="createForm.versionId" placeholder="选择版本" style="width: 100%">
            <el-option v-for="v in versionOptions" :key="v.id" :label="v.name" :value="v.id">
              <span>{{ v.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 12px">{{ v.repoName }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="基线说明" prop="description" class="form-required">
          <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="说明基线的用途和适用范围" />
        </el-form-item>
        <el-form-item label="审批流程">
          <el-select v-model="createForm.approvalFlowId" style="width: 100%">
            <el-option label="标准审批流程" value="1" />
            <el-option label="涉密版本审批" value="2" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">提交审批</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="基线详情" width="700px">
      <div class="baseline-detail" v-if="currentBaseline">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="基线名称">{{ currentBaseline.name }}</el-descriptions-item>
          <el-descriptions-item label="对应版本">{{ currentBaseline.version }}</el-descriptions-item>
          <el-descriptions-item label="所属仓库">{{ currentBaseline.repoName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentBaseline.status === 'active' ? 'success' : 'info'" size="small">
              {{ currentBaseline.status === 'active' ? '激活' : '归档' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建者">{{ currentBaseline.creator }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(currentBaseline.createdAt) }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">基线说明</el-divider>
        <div class="description-content">{{ currentBaseline.description }}</div>
        <el-divider content-position="left">基线演化记录</el-divider>
        <el-timeline>
          <el-timeline-item v-for="(item, index) in currentBaseline.history" :key="index" :timestamp="item.time" placement="top">
            <el-card>
              <h4>{{ item.action }}</h4>
              <p>{{ item.detail }}</p>
              <p class="history-user">操作人: {{ item.user }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)

const baselineList = ref([
  { id: 1, name: 'Baseline-2024-Q1', version: 'v1.0.0', repoId: 1, repoName: '政务系统-用户模块', description: '2024年第一季度基线版本，包含用户管理、权限控制等核心功能', status: 'active', creator: '张三', createdAt: '2024-01-10', history: [] },
  { id: 2, name: 'Baseline-2023-Q4', version: 'v0.9.0', repoId: 1, repoName: '政务系统-用户模块', description: '2023年第四季度基线版本', status: 'active', creator: '李四', createdAt: '2023-10-15', history: [] }
])

const versionOptions = ref([
  { id: 1, name: 'v1.0.0', repoName: '政务系统-用户模块' },
  { id: 2, name: 'v0.9.0', repoName: '政务系统-用户模块' }
])

const currentBaseline = ref(null)

const createForm = reactive({
  name: '',
  versionId: '',
  description: '',
  approvalFlowId: '1'
})

const createRules = {
  name: [{ required: true, message: '请输入基线名称', trigger: 'blur' }],
  versionId: [{ required: true, message: '请选择版本', trigger: 'change' }],
  description: [{ required: true, message: '请输入基线说明', trigger: 'blur' }]
}

onMounted(() => {
  loadBaselines()
})

function loadBaselines() {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 300)
}

function showCreateDialog() {
  createDialogVisible.value = true
}

function handleCreate() {
  ElMessage.success('基线创建申请已提交，等待审批')
  createDialogVisible.value = false
  loadBaselines()
}

function viewDetail(row) {
  currentBaseline.value = row
  detailDialogVisible.value = true
}

function handleChange(row) {
  ElMessage.info('基线变更功能开发中')
}

function handleFreeze(row) {
  ElMessageBox.confirm(`确定要冻结基线 "${row.name}" 吗？冻结后该基线将不能再用于上线。`, '冻结基线', { type: 'warning' })
    .then(() => {
      ElMessage.success('基线已冻结')
      loadBaselines()
    })
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.info-alert {
  margin-bottom: 20px;
}

.baseline-table {
  margin-top: 20px;
}

.baseline-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .baseline-name {
    font-weight: 600;
    color: #303133;
  }
}

.baseline-detail {
  .description-content {
    padding: 15px;
    background: #f5f7fa;
    border-radius: 6px;
    line-height: 1.6;
  }
  
  .history-user {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
  }
}
</style>
