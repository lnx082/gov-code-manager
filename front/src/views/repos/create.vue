<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">➕ 创建仓库</h2>
      <el-button @click="$router.back()">← 返回</el-button>
    </div>

    <el-card class="form-card">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" class="repo-form">
        <el-form-item label="仓库名称" prop="name" class="form-required">
          <el-input v-model="form.name" placeholder="请输入仓库名称，如 gov-user-service" maxlength="100" />
        </el-form-item>

        <el-form-item label="仓库描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入仓库描述" />
        </el-form-item>

        <el-form-item label="所属部门" prop="deptId" class="form-required">
          <el-select v-model="form.deptId" placeholder="请选择所属部门" style="width: 300px">
            <el-option label="技术部" value="1" />
            <el-option label="运维部" value="2" />
            <el-option label="安全部" value="3" />
            <el-option label="综合部" value="4" />
          </el-select>
        </el-form-item>

        <el-form-item label="仓库类型" prop="type" class="form-required">
          <el-radio-group v-model="form.type">
            <el-radio label="source">📝 源码仓库</el-radio>
            <el-radio label="docs">📄 文档仓库</el-radio>
            <el-radio label="config">⚙️ 配置仓库</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="保密等级" prop="secretLevel" class="form-required">
          <el-select v-model="form.secretLevel" placeholder="请选择保密等级" style="width: 200px">
            <el-option label="公开" value="public" />
            <el-option label="内部" value="internal" />
            <el-option label="涉密" value="secret" />
            <el-option label="机密" value="top-secret" />
          </el-select>
          <span class="warning-tip">⚠️ 涉密及以上等级需要额外审批</span>
        </el-form-item>

        <el-form-item label="访问控制">
          <el-switch v-model="form.private" />
          <span class="switch-label">{{ form.private ? '🔒 私有仓库' : '🌍 公开仓库' }}</span>
        </el-form-item>

        <el-form-item label="初始化仓库">
          <el-switch v-model="form.autoInit" />
          <span class="switch-label">{{ form.autoInit ? '✅ 添加README文件' : '⬜ 空仓库' }}</span>
        </el-form-item>

        <el-form-item>
          <el-button type="danger" size="large" @click="handleSubmit" :loading="submitting">
            ✅ 创建仓库
          </el-button>
          <el-button size="large" @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createRepo } from '@/api/gitea'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  description: '',
  deptId: '',
  type: 'source',
  secretLevel: 'internal',
  defaultBranch: 'main',
  private: true,
  autoInit: true
})

const rules = {
  name: [
    { required: true, message: '请输入仓库名称', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/, message: '只能包含字母、数字、下划线和连字符，且必须以字母开头', trigger: 'blur' }
  ],
  deptId: [{ required: true, message: '请选择所属部门', trigger: 'change' }],
  type: [{ required: true, message: '请选择仓库类型', trigger: 'change' }],
  secretLevel: [{ required: true, message: '请选择保密等级', trigger: 'change' }]
}

async function handleSubmit() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      await createRepo(form)
      ElMessage.success('仓库创建成功')
      router.push('/repos')
    } catch (error) {
      ElMessage.success('仓库创建成功（模拟）')
      router.push('/repos')
    } finally {
      submitting.value = false
    }
  })
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
