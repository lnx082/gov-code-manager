<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">部门管理</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        添加部门
      </el-button>
    </div>

    <div class="table-responsive">
      <el-table :data="deptList" stripe border row-key="dept_id" @row-contextmenu.prevent="openMenu">
      <el-table-column prop="name" label="部门名称" />
      <el-table-column prop="leader" label="负责人" width="120" class="col-hide-mobile" />
      <el-table-column prop="description" label="描述" show-overflow-tooltip class="col-hide-mobile" />
      <el-table-column label="状态" width="100" class="col-hide-mobile">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </span>
          <el-button class="action-more-btn" size="small" @click.stop="onTrigger(row, $event)">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      :title="isEditMode ? '编辑部门' : '添加部门'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="deptForm" label-width="100px">
        <el-form-item label="部门名称">
          <el-input v-model="deptForm.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="deptForm.leader" placeholder="请输入负责人" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deptForm.description" type="textarea" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEditMode ? '保存' : '确定' }}
        </el-button>
      </template>
    </el-dialog>

    <RowContextMenu :visible="visible" :position="position" :actions="currentRow ? getActions(currentRow) : []" @close="closeMenu" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, MoreFilled } from '@element-plus/icons-vue'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'
import { getDeptList, createDept, updateDept, deleteDept } from '@/api/admin'

const deptList = ref([])
const showCreateDialog = ref(false)
const submitting = ref(false)
const isEditMode = ref(false)
const currentEditDept = ref(null)

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

function openCreateDialog() {
  isEditMode.value = false
  currentEditDept.value = null
  resetForm()
  showCreateDialog.value = true
}

// 根据部门名称自动生成代码（大写 + 下划线）
function generateCode(name) {
  return name
    .replace(/[^\w一-龥]/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50) || 'DEPT_' + Date.now();
}

function resetForm() {
  deptForm.name = ''
  deptForm.leader = ''
  deptForm.description = ''
}

function handleEdit(row) {
  isEditMode.value = true
  currentEditDept.value = row
  deptForm.name = row.name || ''
  deptForm.leader = row.leader || ''
  deptForm.description = row.description || ''
  showCreateDialog.value = true
}

async function handleSubmit() {
  if (!deptForm.name) {
    ElMessage.warning('请输入部门名称')
    return
  }

  submitting.value = true
  try {
    if (isEditMode.value) {
      await updateDept(currentEditDept.value.dept_id, {
        name: deptForm.name,
        leader: deptForm.leader,
        description: deptForm.description
      })
      ElMessage.success('部门更新成功')
    } else {
      await createDept({
        name: deptForm.name,
        code: generateCode(deptForm.name),
        leader: deptForm.leader,
        description: deptForm.description
      })
      ElMessage.success('部门创建成功')
    }
    showCreateDialog.value = false
    loadDepts()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || (isEditMode.value ? '更新失败' : '添加失败'))
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除部门「${row.name}」吗？\n若该部门下存在活跃用户或子部门，将无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '尝试删除' }
    )
    await deleteDept(row.dept_id)
    ElMessage.success('删除成功')
    loadDepts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.response?.data?.message || '删除失败')
    }
  }
}

// 移动端溢出菜单
const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '编辑', icon: Edit, onClick: () => handleEdit(row) },
    { label: '删除', icon: Delete, type: 'danger', divided: true, onClick: () => handleDelete(row) }
  ]
}

function onTrigger(row, event) {
  openMenu(row, event)
}
</script>

<style lang="scss" scoped>
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
}
</style>
