<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">角色权限管理</h2>
    </div>

    <el-table :data="roleList" stripe border>
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_system ? 'primary' : 'info'" size="small">
            {{ row.is_system ? '系统' : '自定义' }}
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
      <el-table-column label="权限数量" width="100">
        <template #default="{ row }">
          {{ getPermissionCount(row.permissions) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleViewPermissions(row)">查看权限</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showPermissionDialog" title="角色权限" width="600px">
      <div v-if="currentRole">
        <p class="role-desc">{{ currentRole.description }}</p>
        <el-divider />
        <div class="permission-list">
          <el-tag v-for="perm in currentRole.permissions" :key="perm" class="permission-tag">
            {{ perm }}
          </el-tag>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getRoleList } from '@/api/admin'

const roleList = ref([])
const showPermissionDialog = ref(false)
const currentRole = ref(null)

onMounted(() => {
  loadRoles()
})

async function loadRoles() {
  try {
    const res = await getRoleList()
    roleList.value = res.data || []
  } catch (error) {
    ElMessage.error('加载角色列表失败')
  }
}

function handleViewPermissions(row) {
  currentRole.value = row
  showPermissionDialog.value = true
}

function getPermissionCount(permissions) {
  if (!permissions) return 0
  if (permissions === '*') return '全部'
  return permissions.length
}
</script>

<style lang="scss" scoped>
.role-desc {
  color: #909399;
  margin-top: 5px;
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.permission-tag {
  margin: 5px;
}
</style>
