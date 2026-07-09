<template>
  <div class="login-container">
    <div class="login-left">
      <div class="left-content">
        <div class="logo-area">
          <div class="logo-icon">
            <svg viewBox="0 0 100 100" width="80" height="80">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#fff" stroke-width="2"/>
              <path d="M30 50 L45 65 L70 35" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 class="system-title">党政软件版本管控平台</h1>
          <p class="system-subtitle">Government Software Version Control Platform</p>
        </div>
        
        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon">📋</div>
            <div class="feature-text">
              <h3>版本管控</h3>
              <p>规范的软件版本管理流程</p>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🔒</div>
            <div class="feature-text">
              <h3>安全可控</h3>
              <p>分级分类的安全管控体系</p>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <div class="feature-text">
              <h3>全程追溯</h3>
              <p>完整的操作审计记录</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="login-right">
      <div class="login-form-wrapper">
        <div class="form-header">
          <h2>用户登录</h2>
          <p>请输入您的账号信息登录系统</p>
        </div>

        <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" class="login-form">
          <el-form-item prop="username">
            <el-input 
              v-model="loginForm.username" 
              placeholder="请输入用户名"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input 
              v-model="loginForm.password" 
              type="password"
              placeholder="请输入密码"
              prefix-icon="Lock"
              size="large"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item prop="captcha" v-if="showCaptcha">
            <el-input 
              v-model="loginForm.captcha" 
              placeholder="请输入验证码"
              prefix-icon="CircleCheck"
              size="large"
              style="width: 60%"
              @keyup.enter="handleLogin"
            />
            <div class="captcha-code" @click="refreshCaptcha">{{ captchaText }}</div>
          </el-form-item>

          <el-form-item>
            <div class="form-options">
              <el-checkbox v-model="loginForm.remember">记住密码</el-checkbox>
              <a class="forgot-link" @click="handleForgot">忘记密码？</a>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button 
              type="primary" 
              size="large" 
              :loading="loading" 
              class="login-button"
              @click="handleLogin"
            >
              登 录
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-footer">
          <p>技术支持：XX信息技术有限公司</p>
          <p class="copyright">© 2024 版权所有</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, CircleCheck } from '@element-plus/icons-vue'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)
const showCaptcha = ref(false)
const captchaText = ref('AB12')

const loginForm = reactive({
  username: '',
  password: '',
  captcha: '',
  remember: false
})

const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

onMounted(() => {
  // 检查是否已登录
  const token = localStorage.getItem('token')
  if (token) {
    router.push('/dashboard')
  }
})

function refreshCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  captchaText.value = code
}

function handleLogin() {
  loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    
    try {
      // 模拟登录请求
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 保存登录状态
      localStorage.setItem('token', 'mock-token-' + Date.now())
      localStorage.setItem('userInfo', JSON.stringify({
        username: loginForm.username,
        nickname: '管理员',
        role: 'admin'
      }))
      
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } catch (error) {
      ElMessage.error('登录失败，请检查账号密码')
    } finally {
      loading.value = false
    }
  })
}

function handleForgot() {
  ElMessage.info('请联系系统管理员重置密码')
}
</script>

<style lang="scss" scoped>
.login-container {
  display: flex;
  min-height: 100vh;
}

.login-left {
  flex: 1;
  background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  
  .left-content {
    max-width: 500px;
  }
  
  .logo-area {
    text-align: center;
    margin-bottom: 60px;
    
    .logo-icon {
      margin-bottom: 30px;
    }
    
    .system-title {
      font-size: 36px;
      color: #fff;
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .system-subtitle {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.7);
    }
  }
  
  .feature-list {
    .feature-item {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      
      &:last-child {
        border-bottom: none;
      }
      
      .feature-icon {
        font-size: 32px;
      }
      
      .feature-text {
        h3 {
          color: #fff;
          font-size: 18px;
          margin: 0 0 5px;
        }
        
        p {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          margin: 0;
        }
      }
    }
  }
}

.login-right {
  width: 500px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
}

.login-form-wrapper {
  width: 100%;
  max-width: 360px;
  
  .form-header {
    margin-bottom: 40px;
    
    h2 {
      font-size: 28px;
      color: #303133;
      margin: 0 0 10px;
    }
    
    p {
      color: #909399;
      font-size: 14px;
      margin: 0;
    }
  }
}

.login-form {
  :deep(.el-form-item) {
    margin-bottom: 24px;
  }
  
  :deep(.el-input__wrapper) {
    padding: 4px 15px;
    box-shadow: 0 0 0 1px #dcdfe6 inset;
    
    &:hover, &.is-focus {
      box-shadow: 0 0 0 1px #409eff inset;
    }
  }
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .forgot-link {
    color: #409eff;
    font-size: 14px;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.captcha-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35%;
  height: 40px;
  margin-left: 10px;
  background: #f0f0f0;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 4px;
  cursor: pointer;
  color: #303133;
  
  &:hover {
    background: #e0e0e0;
  }
}

.login-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  letter-spacing: 10px;
}

.login-footer {
  margin-top: 60px;
  text-align: center;
  
  p {
    color: #909399;
    font-size: 12px;
    margin: 0 0 5px;
  }
  
  .copyright {
    color: #c0c4cc;
  }
}

@media (max-width: 968px) {
  .login-left {
    display: none;
  }
  
  .login-right {
    width: 100%;
  }
}
</style>
