<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        添加用户
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="搜索用户名" clearable @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.role" placeholder="选择角色" clearable>
            <el-option v-for="role in roles" :key="role.code" :label="role.name" :value="role.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="searchForm.deptId" placeholder="选择部门" clearable>
            <el-option v-for="dept in departments" :key="dept.dept_id" :label="dept.name" :value="dept.dept_id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="userList" v-loading="loading" stripe border>
      <el-table-column prop="gitea_username" label="用户名" width="150">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="32" :icon="UserFilled" />
            <span class="username">{{ row.gitea_username }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag type="primary" size="small">{{ getRoleName(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="department_name" label="部门" width="120">
        <template #default="{ row }">
          {{ row.department_name || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="保密权限" width="100">
        <template #default="{ row }">
          <el-tag :type="getSecretLevelType(row.secret_level)" size="small">
            {{ getSecretLevelName(row.secret_level) }}
          </el-tag>
        </template>
      </el-table-column>
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
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <template v-if="row.role_code !== 'admin'">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="warning" link @click="handleResetPassword(row)">重置密码</el-button>
            <el-button type="danger" link @click="handleLock(row)">
              {{ row.account_locked ? '解锁' : '锁定' }}
            </el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
          <el-tag v-else type="danger" size="small">系统管理员不可操作</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadUsers"
        @current-change="loadUsers"
      />
    </div>

    <!-- 添加/编辑用户对话框 -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="isEditMode ? '编辑用户' : '添加用户'" 
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form 
        ref="userFormRef"
        :model="userForm" 
        :rules="userFormRules"
        label-width="100px"
      >
        <el-form-item label="用户名" prop="username" v-if="!isEditMode">
          <el-input 
            v-model="userForm.username" 
            placeholder="请输入用户名"
            :disabled="isEditMode"
          />
          <div class="form-tip">只能是字母、数字、下划线，字母开头</div>
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" placeholder="请输入邮箱（选填）" :disabled="isEditMode" />
        </el-form-item>

        <el-form-item label="密码" prop="password" v-if="!isEditMode">
          <el-input 
            v-model="userForm.password" 
            type="password"
            placeholder="请输入密码（至少6位）"
            show-password
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword" v-if="!isEditMode">
          <el-input 
            v-model="userForm.confirmPassword" 
            type="password"
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>

        <el-form-item label="部门" prop="departmentId" :rules="[{ required: true, message: '请选择部门', trigger: 'change' }]">
          <el-select v-model="userForm.departmentId" placeholder="请选择部门（必选）" style="width: 100%">
            <el-option
              v-for="dept in departments"
              :key="dept.dept_id"
              :label="dept.name"
              :value="dept.dept_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="角色" prop="roleCode">
          <el-select v-model="userForm.roleCode" placeholder="选择角色" style="width: 100%">
            <el-option
              v-for="role in roles.filter(r => r.code !== 'admin')"
              :key="role.code"
              :label="role.name"
              :value="role.code"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="保密权限" prop="secretLevel">
          <el-select v-model="userForm.secretLevel" placeholder="选择保密权限" style="width: 100%">
            <el-option label="公开" value="public" />
            <el-option label="秘密" value="secret" />
            <el-option label="机密" value="confidential" />
            <el-option label="绝密" value="top-secret" />
          </el-select>
        </el-form-item>

        <el-form-item label="发送通知" prop="sendNotify" v-if="!isEditMode">
          <el-switch v-model="userForm.sendNotify" />
          <span class="switch-tip">创建成功后发送密码通知邮件</span>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEditMode ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="showResetPasswordDialog" title="重置密码" width="450px">
      <el-form ref="resetPasswordFormRef" :model="resetPasswordForm" :rules="resetPasswordRules" label-width="100px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="resetPasswordForm.newPassword" 
            type="password"
            placeholder="请输入新密码（至少6位）"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="resetPasswordForm.confirmPassword" 
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showResetPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleResetPasswordSubmit" :loading="submitting">
          确认重置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'
import { getUserList, createUser, updateUser, deleteUser, lockUser, resetUserPassword } from '@/api/bff'
import { getRoles } from '@/api/bff'
import { getDepartments } from '@/api/bff'

const loading = ref(false)
const submitting = ref(false)
const showCreateDialog = ref(false)
const showResetPasswordDialog = ref(false)
const isEditMode = ref(false)
const currentEditUser = ref(null)
const userFormRef = ref(null)
const resetPasswordFormRef = ref(null)

const searchForm = reactive({
  username: '',
  role: '',
  deptId: ''
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
  password: '',
  confirmPassword: '',
  email: '',
  departmentId: null,
  roleCode: 'developer',
  secretLevel: 'secret',
  sendNotify: true
})

const resetPasswordForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

// 表单验证规则
const validateConfirmPassword = (rule, value, callback) => {
  if (isEditMode.value) {
    callback()
    return
  }
  if (value !== userForm.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const validateResetConfirmPassword = (rule, value, callback) => {
  if (value !== resetPasswordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const userFormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '用户名只能是字母、数字、下划线，且必须以字母开头', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ],
}

const resetPasswordRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateResetConfirmPassword, trigger: 'blur' }
  ]
}

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
      username: searchForm.username || undefined,
      role: searchForm.role || undefined,
      deptId: searchForm.deptId || undefined
    })
    userList.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch (error) {
    ElMessage.error('加载用户列表失败: ' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const res = await getRoles()
    roles.value = res.data || []
  } catch (error) {
    console.error('加载角色列表失败', error)
    // 使用默认角色列表
    roles.value = [
      { code: 'admin', name: '系统管理员' },
      { code: 'project_manager', name: '项目管理员' },
      { code: 'developer', name: '开发人员' },
      { code: 'auditor', name: '审计人员' },
      { code: 'security_auditor', name: '审计人员' },
    ]
  }
}

async function loadDepartments() {
  try {
    const res = await getDepartments()
    departments.value = res.data?.list || res.data || []
  } catch (error) {
    console.error('加载部门列表失败', error)
    departments.value = []
  }
}

function handleSearch() {
  pagination.page = 1
  loadUsers()
}

function resetSearch() {
  searchForm.username = ''
  searchForm.role = ''
  searchForm.deptId = ''
  pagination.page = 1
  loadUsers()
}

function openCreateDialog() {
  isEditMode.value = false
  currentEditUser.value = null
  resetUserForm()
  showCreateDialog.value = true
}

function resetUserForm() {
  userForm.username = ''
  userForm.password = ''
  userForm.confirmPassword = ''
  userForm.departmentId = null
  userForm.roleCode = 'developer'
  userForm.secretLevel = 'secret'
  userForm.sendNotify = true
}

function handleEdit(row) {
  isEditMode.value = true
  currentEditUser.value = row
  userForm.username = row.gitea_username
  userForm.departmentId = row.department_id
  userForm.roleCode = row.role_code || 'developer'
  userForm.secretLevel = row.secret_level || 'internal'
  showCreateDialog.value = true
}

async function handleSubmit() {
  if (!userFormRef.value) return
  
  await userFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      if (isEditMode.value) {
        // 编辑模式（后端使用 user_id 查询）
        const res = await updateUser(currentEditUser.value.user_id, {
          department_id: userForm.departmentId,
          role_code: userForm.roleCode,
          secret_level: userForm.secretLevel
        })
        ElMessage.success('用户信息更新成功')
      } else {
        // 创建模式
        const res = await createUser({
          username: userForm.username,
          password: userForm.password,
          email: userForm.email || undefined,
          departmentId: userForm.departmentId,
          roleCode: userForm.roleCode,
          secretLevel: userForm.secretLevel,
          sendNotify: userForm.sendNotify
        })
        if (res.data?.giteaCreated) {
          ElMessage.success('用户创建成功（已同步创建 Gitea 账户）')
        } else {
          const giteaErr = res.data?.giteaError || '无详细错误信息'
          ElMessage.warning(`用户已创建（本地），但 Gitea 账户同步失败：${giteaErr}。请在 BFF 日志中查看详细信息。`)
        }
      }
      showCreateDialog.value = false
      loadUsers()
    } catch (error) {
      ElMessage.error((error?.response?.data?.message) || error?.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

async function handleResetPassword(row) {
  currentEditUser.value = row
  resetPasswordForm.newPassword = ''
  resetPasswordForm.confirmPassword = ''
  showResetPasswordDialog.value = true
}

async function handleResetPasswordSubmit() {
  if (!resetPasswordFormRef.value) return
  
  await resetPasswordFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      const userId = currentEditUser.value.user_id
      const res = await resetUserPassword(userId, {
        newPassword: resetPasswordForm.newPassword
      })
      ElMessage.success(res.message || '密码重置成功')
      showResetPasswordDialog.value = false
    } catch (error) {
      ElMessage.error((error?.response?.data?.message) || error?.message || '密码重置失败')
    } finally {
      submitting.value = false
    }
  })
}

async function handleLock(row) {
  try {
    await ElMessageBox.confirm(
      `确定要${row.account_locked ? '解锁' : '锁定'}用户 "${row.gitea_username}" 吗？`,
      '确认操作',
      { type: 'warning' }
    )
    // 后端使用 user_id 字段查询，NOT profile_id
    await lockUser(row.user_id, !row.account_locked)
    ElMessage.success(row.account_locked ? '用户已解锁' : '用户已锁定')
    loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${row.gitea_username}" 吗？此操作不可恢复！`,
      '删除确认',
      { type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
    // 后端使用 user_id 字段查询
    await deleteUser(row.user_id)
    ElMessage.success('用户已删除')
    loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error((error?.response?.data?.message) || '删除失败')
    }
  }
}

function getSecretLevelType(level) {
  // 兼容旧值 internal → secret
  const map = {
    public: '',
    internal: 'warning',
    secret: 'warning',
    confidential: 'danger',
    'top-secret': 'danger'
  }
  return map[level] || ''
}

function getSecretLevelName(level) {
  // 兼容旧值 internal → 秘密
  const map = {
    public: '公开',
    internal: '秘密',
    secret: '秘密',
    confidential: '机密',
    'top-secret': '绝密'
  }
  return map[level] || level || '秘密'
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const roleNameMap = {
  'admin': '系统管理员',
  'project_manager': '项目管理员',
  'developer': '开发人员',
  'auditor': '审计人员',
  'security_auditor': '审计人员'
}

function getRoleName(row) {
  return row.role_name || roleNameMap[row.role_code] || '开发人员'
}
</script>

<style lang="scss" scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .username {
    font-weight: 500;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  line-height: 1.4;
}

.switch-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
