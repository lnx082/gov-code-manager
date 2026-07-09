<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统设置</h2>
    </div>

    <el-card>
      <template #header>
        <span>版本规则配置</span>
      </template>
      <el-form :model="versionRules" label-width="150px">
        <el-form-item label="默认版本格式">
          <el-input v-model="versionRules.defaultPattern" />
        </el-form-item>
        <el-form-item label="创建 Tag 时强制校验">
          <el-switch v-model="versionRules.enforceOnTagCreation" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSaveVersionRules">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mt-20">
      <template #header>
        <span>审批流程配置</span>
      </template>
      <el-table :data="approvalFlows" stripe>
        <el-table-column prop="name" label="流程名称" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="默认流程">
          <template #default="{ row }">
            <el-tag v-if="row.is_default" type="success">是</el-tag>
            <span v-else>否</span>
          </template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getVersionRules, updateVersionRules } from '@/api/version'
import { getApprovalFlows } from '@/api/approval'

const versionRules = reactive({
  defaultPattern: 'MAJOR.MINOR.PATCH',
  enforceOnTagCreation: true
})

const approvalFlows = ref([])

onMounted(() => {
  loadVersionRules()
  loadApprovalFlows()
})

async function loadVersionRules() {
  try {
    const res = await getVersionRules()
    if (res.data) {
      Object.assign(versionRules, res.data)
    }
  } catch (error) {
    console.error('加载版本规则失败', error)
  }
}

async function loadApprovalFlows() {
  try {
    const res = await getApprovalFlows()
    approvalFlows.value = res.data || []
  } catch (error) {
    console.error('加载审批流程失败', error)
  }
}

async function handleSaveVersionRules() {
  try {
    await updateVersionRules(versionRules)
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}
</script>

<style lang="scss" scoped>
.mt-20 {
  margin-top: 20px;
}
</style>
