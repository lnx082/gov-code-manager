<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">个人信息</h2>
    </div>

    <el-card>
      <el-form :model="form" label-width="120px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item label="角色">
          <el-input :value="userStore.roleName" disabled />
        </el-form-item>
        <el-form-item label="部门">
          <el-input :value="userStore.userInfo?.departmentName || '未分配'" disabled />
        </el-form-item>
        <el-form-item label="保密等级">
          <el-input :value="getSecretLevelName(userStore.userInfo?.secretLevel)" disabled />
        </el-form-item>
        <el-form-item label="最后登录">
          <el-input :value="formatTime(userStore.userInfo?.lastLoginTime)" disabled />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getMySessions, deleteSession } from '@/api/user'

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

onMounted(() => {
  if (userStore.userInfo) {
    form.username = userStore.userInfo.username
    form.nickname = userStore.userInfo.nickname
  }
  loadSessions()
})

async function loadSessions() {
  try {
    const res = await getMySessions()
    sessions.value = res.data || []
  } catch (error) {
    console.error('获取会话失败', error)
  }
}

function handleSave() {
  ElMessage.success('保存成功')
}

function handleChangePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.error('两次密码输入不一致')
    return
  }
  ElMessage.success('密码修改成功')
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
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
  const map = { 'public': '公开', 'internal': '内部', 'secret': '涉密', 'top-secret': '机密' }
  return map[level] || level || '内部'
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
