<template>
  <div class="gov-login-page">
    <!-- 全屏背景 -->
    <div class="login-bg">
      <img :src="loginImage" alt="" class="bg-image" />
      <div class="bg-overlay" />
    </div>

    <!-- 左侧：党政软件版本管控平台 -->
    <div class="left-panel">
      <div class="left-emblem">
        <el-icon :size="48"><Platform /></el-icon>
      </div>
      <h2 class="left-title">党政软件版本管控平台</h2>
      <p class="left-desc">符合等保2.0三级要求，全流程审计溯源<br/>多级审批流程，版本管控规范化</p>
      <div class="left-tags">
        <span class="tag">安全可控</span>
        <span class="tag">合规审批</span>
        <span class="tag">全程溯源</span>
      </div>
    </div>

    <!-- 右侧：登录卡片 -->
    <div class="login-card">
      <div class="card-header">
        <div class="card-emblem">
          <el-icon :size="32"><Platform /></el-icon>
        </div>
        <h3 class="card-title">用户登录</h3>
        <p class="card-subtitle">请使用您的账号登录系统</p>
      </div>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <div class="input-wrapper">
            <el-icon class="input-icon"><User /></el-icon>
            <el-input v-model="loginForm.username" placeholder="请输入用户名" size="large" clearable />
          </div>
        </el-form-item>

        <el-form-item prop="password">
          <div class="input-wrapper">
            <el-icon class="input-icon"><Lock /></el-icon>
            <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" size="large" show-password clearable />
          </div>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="loginForm.remember">记住登录状态</el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button size="large" :loading="loading" class="login-button" @click="handleLogin">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div class="security-notice">
        <el-icon><WarningFilled /></el-icon>
        <span>本系统处于安全监控下，请使用本人账号登录</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { Lock, User, WarningFilled, Platform } from '@element-plus/icons-vue'
import loginImage from '@/assets/VCG211511234644.jpg'

const router = useRouter()
const userStore = useUserStore()

const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(() => {
  if (userStore.isAuthenticated) router.push('/dashboard')
})

async function handleLogin() {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await userStore.loginAction(loginForm.username, loginForm.password)
      // 重新加载用户信息，避免使用登录响应的缓存数据
      await userStore.initUser()
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } catch (error) {
      ElMessage.error('账号或密码错误，请重新输入')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style lang="scss" scoped>
.gov-login-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  background: #1a1a2e;
}

/* 全屏背景 */
.login-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  .bg-image { width: 100%; height: 100%; object-fit: cover; }
  .bg-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg,
      rgba(196, 18, 48, 0.8) 0%,
      rgba(139, 0, 0, 0.5) 40%,
      rgba(26, 26, 46, 0.4) 70%,
      rgba(26, 26, 46, 0.85) 100%);
  }
}

/* 左侧面板 */
.left-panel {
  position: relative;
  z-index: 1;
  margin-left: 12vw;
  max-width: 440px;
  color: #fff;
  text-align: center;

  .left-emblem {
    width: 96px;
    height: 96px;
    margin: 0 auto 32px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(4px);
  }

  .left-title {
    font-size: 46px;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: 4px;
    margin-bottom: 20px;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    font-family: 'MaoTi', 'STLiti', 'FZXiaoZhuanTi', cursive;
  }

  .left-desc {
    font-size: 16px;
    line-height: 1.8;
    opacity: 0.7;
    margin-bottom: 32px;
  }

  .left-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;

    .tag {
      padding: 8px 20px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      font-size: 14px;
      backdrop-filter: blur(4px);
    }
  }
}

/* 右侧登录卡片 */
.login-card {
  position: relative;
  z-index: 1;
  width: 400px;
  max-width: 88vw;
  margin-right: calc(2vw + 10px);
  padding: 40px 36px 32px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 20px;
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);

  .card-header {
    text-align: center;
    margin-bottom: 36px;

    .card-emblem {
      width: 60px;
      height: 60px;
      margin: 0 auto 14px;
      background: linear-gradient(135deg, #c41230 0%, #8b0000 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 6px 20px rgba(196, 18, 48, 0.35);
      border: 2px solid rgba(255, 255, 255, 0.15);
    }

    .card-title {
      font-size: 24px;
      color: #fff;
      font-weight: 600;
      margin-bottom: 6px;
      letter-spacing: 2px;
    }

    .card-subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.45);
    }
  }

  .login-form {
    :deep(.el-form-item) {
      margin-bottom: 20px;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      height: 48px;
      width: 100%;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      transition: all 0.3s ease;

      &:hover {
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
      }

      &:focus-within {
        border-color: #c41230;
        background: rgba(196, 18, 48, 0.06);
        box-shadow: 0 0 0 3px rgba(196, 18, 48, 0.1);
      }

      .input-icon {
        font-size: 18px;
        color: rgba(255, 255, 255, 0.4);
        flex-shrink: 0;
        transition: color 0.3s;
      }

      &:focus-within .input-icon {
        color: #c41230;
      }

      :deep(.el-input) {
        background: transparent !important;
      }

      :deep(.el-input__wrapper) {
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        padding: 0;
        flex: 1;
      }

      :deep(.el-input__inner) {
        color: #fff;
        background: transparent !important;
        border: none;
        height: 48px;
        font-size: 15px;

        &::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
      }
    }

    :deep(.el-checkbox) {
      .el-checkbox__label {
        color: rgba(255, 255, 255, 0.45);
        font-size: 13px;
      }
      .el-checkbox__input.is-checked .el-checkbox__inner {
        background: #c41230;
        border-color: #c41230;
      }
    }

    .login-button {
      width: 100%;
      height: 48px;
      font-size: 16px;
      font-weight: 600;
      background: linear-gradient(135deg, #c41230 0%, #a01020 50%, #8b0000 100%);
      border: none;
      border-radius: 12px;
      color: #fff;
      letter-spacing: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
        pointer-events: none;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(196, 18, 48, 0.4);
      }

      &:active {
        transform: translateY(0);
        box-shadow: none;
      }
    }
  }

  .security-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 28px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;

    .el-icon {
      font-size: 14px;
      color: rgba(255, 215, 0, 0.4);
    }
  }
}

@media (max-width: 820px) {
  .left-panel { display: none; }
  .gov-login-page { justify-content: center; }
  .login-card { margin-right: 0; }
}
</style>
