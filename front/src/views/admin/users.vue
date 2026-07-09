<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        添加用户
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="搜索用户名" clearable />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.role" placeholder="选择角色" clearable>
            <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="userList" v-loading="loading" stripe border>
      <el-table-column prop="gitea_username" label="用户名" width="150" />
      <el-table-column prop="nickname" label="昵称" width="120" />
      <el-table-column prop="role_name" label="角色" width="120" />
      <el-table-column prop="department_name" label="部门" width="120" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账户状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.account_locked ? 'danger' : 'success'" size="small">
            {{ row.account_locked ? '已锁定' : '正常' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后登录" width="160">
        <template #default="{ row }">
          {{ formatTime(row.last_login_time) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="warning" link @click="handleLock(row)">
            {{ row.account_locked ? '解锁' : '锁定' }}
          </el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadUsers"
      />
    </div>

    <el-dialog v-model="showCreateDialog" title="添加用户" width="500px">
      <el-form :model="userForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="userForm.username" placeholder="Gitea 用户名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.roleCode">
            <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="userForm.departmentId" clearable>
            <el-option v-for="dept in departments" :key="dept.dept_id" :label="dept.name" :value="dept.dept_id" />
          </el-select>
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
import { getUserList, updateUser, deleteUser, lockUser } from '@/api/user'
import { getRoleList } from '@/api/admin'
import { getDeptList } from '@/api/admin'

const loading = ref(false)
const showCreateDialog = ref(false)

const searchForm = reactive({
  username: '',
  role: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const userList = ref([])
const roles = ref([])
const departments = ref([])

const userForm = reactive({
  username: '',
  roleCode: 'user',
  departmentId: null
})

onMounted(() => {
  loadUsers()
  loadRoles()
  loadDepartments()
})

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUserList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      username: searchForm.username,
      role: searchForm.role
    })
    userList.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const res = await getRoleList()
    roles.value = res.data || []
  } catch (error) {
    console.error('加载角色列表失败', error)
  }
}

async function loadDepartments() {
  try {
    const res = await getDeptList()
    departments.value = res.data || []
  } catch (error) {
    console.error('加载部门列表失败', error)
  }
}

function handleSearch() {
  pagination.page = 1
  loadUsers()
}

function resetSearch() {
  searchForm.username = ''
  searchForm.role = ''
  handleSearch()
}

function handleEdit(row) {
  ElMessage.info('编辑功能开发中')
}

async function handleLock(row) {
  try {
    await lockUser(row.profile_id, !row.account_locked)
    ElMessage.success(row.account_locked ? '已解锁' : '已锁定')
    loadUsers()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除该用户吗？', '删除确认', { type: 'warning' })
    await deleteUser(row.profile_id)
    ElMessage.success('删除成功')
    loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

async function handleCreate() {
  ElMessage.success('用户创建成功')
  showCreateDialog.value = false
  loadUsers()
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
