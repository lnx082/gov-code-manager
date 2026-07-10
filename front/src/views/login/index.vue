<template>
  <div class="gov-login-page">
    <!-- 顶部政务横幅 -->
    <div class="gov-banner">
      <div class="banner-content">
        <div class="banner-left">
          <el-icon :size="36" class="party-emblem"><Platform /></el-icon>
          <span class="banner-title">党政软件版本管控平台</span>
        </div>
        <div class="banner-right">
          <span class="hotline">服务热线：400-XXX-XXXX</span>
        </div>
      </div>
    </div>

    <!-- 登录主体 -->
    <div class="login-main">
      <!-- 左侧宣传区 -->
      <div class="login-left">
        <div class="gov-info">
          <h2>党政软件版本管控平台</h2>
          <div class="feature-list">
            <div class="feature-item">
              <el-icon class="feature-icon"><Lock /></el-icon>
              <div class="feature-text">
                <h4>安全可控</h4>
                <p>符合等保2.0三级要求，全流程审计溯源</p>
              </div>
            </div>
            <div class="feature-item">
              <el-icon class="feature-icon"><DocumentChecked /></el-icon>
              <div class="feature-text">
                <h4>合规审批</h4>
                <p>多级审批流程，版本管控规范化</p>
              </div>
            </div>
            <div class="feature-item">
              <el-icon class="feature-icon"><Checked /></el-icon>
              <div class="feature-text">
                <h4>信创适配</h4>
                <p>国产化环境适配，麒麟鲲鹏兼容</p>
              </div>
            </div>
            <div class="feature-item">
              <el-icon class="feature-icon"><DataAnalysis /></el-icon>
              <div class="feature-text">
                <h4>全程溯源</h4>
                <p>防篡改审计日志，操作永久留存</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div class="login-right">
        <div class="login-box">
          <div class="login-header">
            <div class="emblem-wrapper">
              <el-icon :size="48" class="login-emblem"><Platform /></el-icon>
            </div>
            <h1>用户登录</h1>
            <p class="login-subtitle">请使用您的账号登录系统</p>
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
                <el-input
                  v-model="loginForm.username"
                  placeholder="请输入用户名"
                  size="large"
                  clearable
                />
              </div>
            </el-form-item>

            <el-form-item prop="password">
              <div class="input-wrapper">
                <el-icon class="input-icon"><Lock /></el-icon>
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
                  size="large"
                  show-password
                  clearable
                />
              </div>
            </el-form-item>

            <el-form-item>
              <el-checkbox v-model="loginForm.remember">记住登录状态</el-checkbox>
            </el-form-item>

            <el-form-item>
              <el-button
                type="danger"
                size="large"
                :loading="loading"
                class="login-button"
                @click="handleLogin"
              >
                {{ loading ? '登录中...' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>

          <div class="login-footer">
            <div class="security-notice">
              <el-icon class="notice-icon"><WarningFilled /></el-icon>
              <span>本系统处于安全监控下，请使用本人账号登录</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部版权信息 -->
    <div class="gov-footer">
      <div class="footer-content">
        <p>党政软件版本管控平台 © 2026 版权所有</p>
        <p>技术支持：电科院52组</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { Lock, DocumentChecked, Checked, DataAnalysis, User, WarningFilled, Platform } from '@element-plus/icons-vue'

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
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

onMounted(() => {
  if (userStore.isAuthenticated) {
    router.push('/dashboard')
  }
})

async function handleLogin() {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      await userStore.loginAction(loginForm.username, loginForm.password)
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } catch (error) {
      ElMessage.error(error.message || '登录失败，请检查账号密码')
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
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);
}

/* 顶部横幅 */
.gov-banner {
  background: linear-gradient(90deg, #c41230 0%, #8b0000 50%, #c41230 100%);
  color: #fff;
  padding: 10px 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);

  .banner-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
  }

  .banner-left {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .party-emblem {
    width: 40px;
    height: 40px;
  }

  .banner-title {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 2px;
  }

  .hotline {
    font-size: 14px;
    opacity: 0.9;
  }
}

/* 登录主体 */
.login-main {
  flex: 1;
  display: flex;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 20px;
  gap: 60px;
}

/* 左侧宣传区 */
.login-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  .gov-info {
    h2 {
      font-size: 32px;
      color: #c41230;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .subtitle {
      font-size: 16px;
      color: #666;
      margin-bottom: 40px;
    }

    .feature-list {
      .feature-item {
        display: flex;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 30px;
        padding: 20px;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 2px 15px rgba(0, 0, 0, 0.08);
        transition: transform 0.3s, box-shadow 0.3s;

        &:hover {
          transform: translateY(-5px);
          box-shadow: 0 5px 25px rgba(0, 0, 0, 0.12);
        }

        .feature-icon {
          font-size: 36px;
        }

        .feature-text {
          h4 {
            font-size: 18px;
            color: #333;
            margin-bottom: 5px;
          }

          p {
            font-size: 14px;
            color: #666;
          }
        }
      }
    }
  }
}

/* 右侧登录框 */
.login-right {
  flex: 0 0 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-box {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);

  .login-header {
    text-align: center;
    margin-bottom: 30px;

    .emblem-wrapper {
      margin-bottom: 20px;
    }

    .login-emblem {
      width: 60px;
      height: 60px;
    }

    h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 8px;
    }

    .login-subtitle {
      color: #999;
      font-size: 14px;
    }
  }

  .login-form {
    .input-wrapper {
      display: flex;
      align-items: center;
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 0 15px;
      transition: border-color 0.3s;

      &:focus-within {
        border-color: #c41230;
      }

      .input-icon {
        font-size: 18px;
        margin-right: 10px;
      }

      :deep(.el-input__wrapper) {
        box-shadow: none;
        flex: 1;
      }

      :deep(.el-input__inner) {
        border: none;
      }
    }

    .login-button {
      width: 100%;
      height: 48px;
      font-size: 16px;
      background: linear-gradient(90deg, #c41230 0%, #8b0000 100%);
      border: none;
      border-radius: 6px;

      &:hover {
        background: linear-gradient(90deg, #d4213f 0%, #9b1010 100%);
      }
    }
  }

  .login-footer {
    margin-top: 20px;

    .security-notice {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: #fff8e6;
      border-radius: 6px;
      color: #856404;
      font-size: 13px;

      .notice-icon {
        font-size: 16px;
      }
    }
  }
}

/* 底部版权 */
.gov-footer {
  background: #fff;
  color: #666;
  padding: 20px 0;
  text-align: center;
  border-top: 1px solid #e4e7ed;

  .footer-content {
    p {
      margin: 5px 0;
      font-size: 13px;
    }
  }
}
</style>
