<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title"><el-icon><Plus /></el-icon> 创建仓库</h2>
      <el-button @click="$router.back()"><el-icon><Back /></el-icon> 返回</el-button>
    </div>

    <el-card class="form-card">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="repo-form">
        <el-form-item label="仓库名称" prop="name">
          <el-input v-model="form.name" placeholder="如 gov-user-service" maxlength="100" style="width: 360px" />
        </el-form-item>

        <el-form-item label="仓库描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入仓库描述" style="width: 360px" />
        </el-form-item>

        <el-form-item label="仓库类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio label="source"><el-icon><Edit /></el-icon> 源码仓库</el-radio>
            <el-radio label="docs"><el-icon><Document /></el-icon> 文档仓库</el-radio>
            <el-radio label="config"><el-icon><Setting /></el-icon> 配置仓库</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="仓库密级" prop="secretLevel">
          <el-radio-group v-model="form.secretLevel">
            <el-radio label="public">公开</el-radio>
            <el-radio label="secret">秘密</el-radio>
            <el-radio label="confidential">机密</el-radio>
            <el-radio label="top-secret">绝密</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="初始化仓库">
          <el-switch v-model="form.autoInit" />
          <span class="switch-label">{{ form.autoInit ? '添加README.md文件' : '空仓库' }}</span>
        </el-form-item>

        <el-form-item>
          <el-button type="danger" size="large" @click="handleSubmit" :loading="submitting">
            <el-icon><CircleCheck /></el-icon> 创建仓库
          </el-button>
          <el-button size="large" @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Plus, Back, Edit, Document, Setting, WarningFilled, CircleCheck } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createRepo } from '@/api/gitea'
import { pinyin } from 'pinyin-pro'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  description: '',
  type: 'source',
  secretLevel: 'secret',
  autoInit: true
})

// 密级对应的 Gitea 可见性
const secretLevelMap = {
  public: { private: false, label: '公开' },
  secret: { private: true, label: '秘密' },
  confidential: { private: true, label: '机密' },
  'top-secret': { private: true, label: '绝密' },
}

const rules = {
  name: [
    { required: true, message: '请输入仓库名称', trigger: 'blur' },
  ],
  type: [
    { required: true, message: '请选择仓库类型', trigger: 'change' }
  ],
  secretLevel: [
    { required: true, message: '请选择仓库密级', trigger: 'change' }
  ]
}

const typeReadmeMap = {
  source: '# 源码仓库\n\n## 项目简介\n\n请在此描述项目的功能和技术架构。\n\n## 快速开始\n\n```bash\ngit clone <repo-url>\ncd <project>\n```\n\n## 技术栈\n\n- 后端：\n- 前端：\n- 数据库：\n\n## 许可证\n\n内部使用',
  docs: '# 文档仓库\n\n## 文档目录\n\n- [需求文档](docs/requirements/)\n- [设计文档](docs/design/)\n- [API 文档](docs/api/)\n- [用户手册](docs/manual/)\n\n## 维护说明\n\n本文档仓库用于存放项目相关文档。',
  config: '# 配置仓库\n\n## 环境配置\n\n- `development` - 开发环境\n- `staging` - 测试环境\n- `production` - 生产环境\n\n## 配置说明\n\n请在各环境目录下维护对应配置文件。\n\n## 安全提示\n\n⚠️ 请勿将密钥、密码等敏感信息提交到此仓库。'
}

async function handleSubmit() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过
  }

  submitting.value = true
  try {
    // 中文仓库名转拼音作为 Gitea 仓库名，原中文名存入描述
    const sl = secretLevelMap[form.secretLevel] || secretLevelMap.secret
    const rawName = form.name.trim()
    const hasChinese = /[一-龥]/.test(rawName)
    let repoName, displayTag

    if (hasChinese) {
      // 转拼音：取每个字首字母 + 全拼，去重
      const pyArr = pinyin(rawName, { toneType: 'none', type: 'array' })
      const short = pyArr.map(s => s[0]).join('')
      const full = pyArr.join('')
      // 拼音去重 + 短横线连接，确保 Gitea 合法
      repoName = `${short}_${full}`.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
      if (!repoName || repoName.length < 2) repoName = `repo_${Date.now()}`
      displayTag = `[显示名=${rawName}]`
    } else {
      repoName = rawName
      displayTag = ''
    }

    const desc = form.description
      ? `${displayTag}[${sl.label}][${form.type}] ${form.description}`
      : `${displayTag}[${sl.label}][${form.type}] ${typeReadmeMap[form.type]?.split('\n')[0]?.replace('# ', '') || ''}`

    await createRepo({
      name: repoName,
      description: desc,
      private: sl.private,
      auto_init: form.autoInit,
      default_branch: 'main'
    })
    ElMessage.success('仓库创建成功')
    router.push('/repos')
  } catch (error) {
    console.error('创建仓库失败:', error)
    ElMessage.error('创建仓库失败：' + (error?.response?.data?.message || error?.message || '未知错误'))
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.form-card { max-width: 800px; }

.repo-form {
  padding: 20px;
  
  .warning-tip {
    margin-left: 15px;
    color: #e6a23c;
    font-size: 13px;
  }
  
  .switch-label {
    margin-left: 10px;
    color: #606266;
  }
}
</style>
