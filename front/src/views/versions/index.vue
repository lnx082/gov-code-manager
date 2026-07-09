<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">🏷️ 版本列表</h2>
      <div class="button-group">
        <el-button type="danger" @click="showCreateTag">➕ 创建版本</el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="仓库">
          <el-select v-model="filterForm.repoId" placeholder="选择仓库" clearable style="width: 200px">
            <el-option label="政务系统-用户模块" value="1" />
            <el-option label="政务系统-审批模块" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本类型">
          <el-select v-model="filterForm.type" clearable style="width: 150px">
            <el-option label="正式版本" value="release" />
            <el-option label="测试版本" value="beta" />
          </el-select>
        </el-form-item>
        <el-form-item label="保密等级">
          <el-select v-model="filterForm.secretLevel" clearable style="width: 150px">
            <el-option label="公开" value="public" />
            <el-option label="内部" value="internal" />
            <el-option label="涉密" value="secret" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="danger" @click="handleFilter">🔍 筛选</el-button>
          <el-button @click="resetFilter">🔄 重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="versionList" v-loading="loading" stripe border>
      <el-table-column label="版本号" width="150">
        <template #default="{ row }">
          <div class="version-cell">
            <span>🏷️</span>
            <span class="version-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="版本说明" min-width="200" show-overflow-tooltip />
      <el-table-column prop="repoName" label="所属仓库" width="180" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'release' ? 'success' : 'warning'" size="small">
            {{ row.type === 'release' ? '正式' : '测试' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否基线" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.isBaseline" type="success" size="small">✅ 基线</el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="创建者" width="100" />
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="viewVersionDetail(row)">👁️ 详情</el-button>
          <el-button type="primary" link @click="downloadVersion(row)">📥 下载</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadVersions"
      />
    </div>

    <el-dialog v-model="createTagDialogVisible" title="🏷️ 创建版本" width="600px">
      <el-form :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="所属仓库" prop="repoId" class="form-required">
          <el-select v-model="createForm.repoId" placeholder="选择仓库" style="width: 100%">
            <el-option label="政务系统-用户模块" value="1" />
            <el-option label="政务系统-审批模块" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号" prop="name" class="form-required">
          <el-input v-model="createForm.name" placeholder="v1.0.0" />
          <div class="form-tip">建议遵循语义化版本规范：主版本号.次版本号.修订号</div>
        </el-form-item>
        <el-form-item label="版本说明" prop="message" class="form-required">
          <el-input v-model="createForm.message" type="textarea" :rows="4" placeholder="描述本次版本的主要变更内容" />
        </el-form-item>
        <el-form-item label="版本类型">
          <el-radio-group v-model="createForm.type">
            <el-radio label="release">🏷️ 正式版本</el-radio>
            <el-radio label="beta">🧪 测试版本</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关联审批">
          <el-switch v-model="createForm.requireApproval" />
          <span class="switch-tip">正式版本需要完成审批流程后才能创建</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createTagDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleCreateTag">创建版本</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const createTagDialogVisible = ref(false)

const filterForm = reactive({ repoId: '', type: '', secretLevel: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const versionList = ref([
  { id: 1, name: 'v1.0.0', message: '政务系统正式版本发布，包含用户管理、权限控制等核心功能', repoId: 1, repoName: '政务系统-用户模块', type: 'release', isBaseline: true, sha: 'a1b2c3d4e5f6', author: '张三', createdAt: '2024-01-10' },
  { id: 2, name: 'v0.9.0', message: '测试版本，新增消息通知功能', repoId: 1, repoName: '政务系统-用户模块', type: 'beta', isBaseline: false, sha: 'b2c3d4e5f6a1', author: '李四', createdAt: '2024-01-05' }
])

const createForm = reactive({
  repoId: '',
  name: '',
  message: '',
  type: 'release',
  requireApproval: true
})

const createRules = {
  repoId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  name: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
  message: [{ required: true, message: '请输入版本说明', trigger: 'blur' }]
}

onMounted(() => { loadVersions() })

function loadVersions() {
  loading.value = true
  setTimeout(() => {
    pagination.total = versionList.value.length
    loading.value = false
  }, 300)
}

function handleFilter() { loadVersions() }
function resetFilter() { Object.keys(filterForm).forEach(key => filterForm[key] = ''); loadVersions() }
function showCreateTag() { createTagDialogVisible.value = true }

async function handleCreateTag() {
  ElMessage.success('版本创建成功')
  createTagDialogVisible.value = false
  loadVersions()
}

function viewVersionDetail(row) { ElMessage.info(`查看版本: ${row.name}`) }
function downloadVersion(row) { ElMessage.success(`开始下载版本: ${row.name}`) }

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.version-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .version-name {
    color: #c41230;
    font-weight: 600;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.switch-tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}
</style>
