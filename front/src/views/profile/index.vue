<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">个人信息</h2>
    </div>

    <el-card>
      <el-form :model="form" label-width="120px" v-if="profileLoaded">
        <el-form-item label="用户名">
          <el-input v-model="form.username" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item label="角色">
          <el-input :value="profileRoleName" disabled />
        </el-form-item>
        <el-form-item label="部门">
          <el-input :value="profileDepartmentName || '未分配'" disabled />
        </el-form-item>
        <el-form-item label="保密等级">
          <el-input :value="getSecretLevelName(profileSecretLevel)" disabled />
        </el-form-item>
        <el-form-item label="最后登录">
          <el-input :value="formatTime(profileLastLoginTime)" disabled />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mt-20">
      <template #header>
        <span>安全设置</span>
      </template>
      <el-form label-width="120px">
        <el-form-item label="当前密码">
          <el-input type="password" v-model="passwordForm.oldPassword" placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input type="password" v-model="passwordForm.newPassword" placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input type="password" v-model="passwordForm.confirmPassword" placeholder="请确认新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleChangePassword">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mt-20">
      <template #header>
        <span>会话管理</span>
      </template>
      <el-table :data="sessions" stripe>
        <el-table-column prop="ip_address" label="登录IP" />
        <el-table-column prop="user_agent" label="登录设备" show-overflow-tooltip />
        <el-table-column prop="created_at" label="登录时间" />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button type="danger" link @click="handleDeleteSession(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
/**
 * 个人中心
 * 功能：展示用户信息（角色/部门/密级/登录时间）、修改密码、会话管理
 * 数据来源：独立调用 /auth/me 获取数据库最新数据，不依赖 store 缓存
 * 注：v-if="profileLoaded" 控制表单渲染，API 返回前不显示内容避免闪烁
 */
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getMySessions, deleteSession, updateUser, changePassword, getUserInfo } from '@/api/user'

const userStore = useUserStore()

const form = reactive({
  username: '',
  nickname: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const sessions = ref([])

// 直接从后端获取的数据，完全绕过 store 可能存在的旧缓存
const profileRoleName = ref('')
const profileDepartmentName = ref('')
const profileSecretLevel = ref('')
const profileLastLoginTime = ref(null)
const profileLoaded = ref(false)

onMounted(async () => {
  await refreshUserInfo()
  loadSessions()
})

async function refreshUserInfo() {
  try {
    const res = await getUserInfo()
    // getUserInfo 返回的是 axios 响应中 data 字段（已是 /auth/me 的 data 对象）
    if (res?.data) {
      form.username = res.data.username || ''
      form.nickname = res.data.nickname || ''
      // 直接用后端返回的最新数据，不依赖 store
      profileRoleName.value = res.data.roleName || ''
      profileDepartmentName.value = res.data.departmentName || ''
      profileSecretLevel.value = res.data.secretLevel || ''
      profileLastLoginTime.value = res.data.lastLoginTime || null
    }
  } catch (e) {
    // 后端请求失败时，才降级使用 store 缓存
    profileRoleName.value = userStore.roleName
    profileDepartmentName.value = userStore.userInfo?.departmentName || ''
    profileSecretLevel.value = userStore.userInfo?.secretLevel || ''
    profileLastLoginTime.value = userStore.userInfo?.lastLoginTime || null
    form.username = userStore.userInfo?.username || ''
    form.nickname = userStore.userInfo?.nickname || ''
  }
  profileLoaded.value = true
}

async function loadSessions() {
  try {
    const res = await getMySessions()
    sessions.value = res.data || []
  } catch (error) {
    console.error('获取会话失败', error)
  }
}

async function handleSave() {
  try {
    const userId = userStore.userInfo?.id || userStore.userInfo?.userId
    if (userId) {
      await updateUser(userId, { nickname: form.nickname })
    }
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.warning('保存失败')
  }
}

async function handleChangePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.error('两次密码输入不一致')
    return
  }
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    ElMessage.error('请填写完整密码信息')
    return
  }
  try {
    const res = await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    ElMessage.success(res.message || '密码修改成功')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    ElMessage.warning(error?.response?.data?.message || '密码修改失败')
  }
}

async function handleDeleteSession(row) {
  try {
    await deleteSession(row.session_id)
    ElMessage.success('会话已删除')
    loadSessions()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

function getSecretLevelName(level) {
  const map = { 'public': '公开', 'internal': '秘密', 'secret': '秘密', 'confidential': '机密', 'top-secret': '绝密' }
  return map[level] || level || '秘密'
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.mt-20 {
  margin-top: 20px;
}
</style>
