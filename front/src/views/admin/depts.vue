<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">部门管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        添加部门
      </el-button>
    </div>

    <el-table :data="deptList" stripe border row-key="dept_id">
      <el-table-column prop="name" label="部门名称" />
      <el-table-column prop="code" label="部门代码" width="150" />
      <el-table-column prop="leader" label="负责人" width="120" />
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="添加部门" width="500px">
      <el-form :model="deptForm" label-width="100px">
        <el-form-item label="部门名称">
          <el-input v-model="deptForm.name" />
        </el-form-item>
        <el-form-item label="部门代码">
          <el-input v-model="deptForm.code" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="deptForm.leader" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deptForm.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDeptList, createDept, deleteDept } from '@/api/admin'

const deptList = ref([])
const showCreateDialog = ref(false)

const deptForm = reactive({
  name: '',
  code: '',
  leader: '',
  description: ''
})

onMounted(() => {
  loadDepts()
})

async function loadDepts() {
  try {
    const res = await getDeptList({ tree: 'false' })
    deptList.value = res.data || []
  } catch (error) {
    ElMessage.error('加载部门列表失败')
  }
}

async function handleCreate() {
  try {
    await createDept(deptForm)
    ElMessage.success('添加成功')
    showCreateDialog.value = false
    Object.keys(deptForm).forEach(key => deptForm[key] = '')
    loadDepts()
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

function handleEdit(row) {
  ElMessage.info('编辑功能开发中')
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除该部门吗？', '删除确认', { type: 'warning' })
    await deleteDept(row.dept_id)
    ElMessage.success('删除成功')
    loadDepts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>
