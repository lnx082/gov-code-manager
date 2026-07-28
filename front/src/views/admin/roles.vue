<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">角色权限管理</h2>
    </div>

    <div class="table-responsive">
      <el-table :data="roleList" stripe border @row-contextmenu.prevent="openMenu">
      <el-table-column label="角色名称" width="150">
        <template #default="{ row }">
          {{ row.role_name || row.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" show-overflow-tooltip min-width="200" class="col-hide-mobile" />
      <el-table-column label="类型" width="100" class="col-hide-mobile">
        <template #default="{ row }">
          <el-tag :type="row.is_system ? 'primary' : 'info'" size="small">
            {{ row.is_system ? '系统' : '自定义' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" class="col-hide-mobile">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="权限数量" width="100" class="col-hide-mobile">
        <template #default="{ row }">
          {{ getPermissionCount(row.permissions) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="handleViewPermissions(row)">查看权限</el-button>
          </span>
          <el-button class="action-more-btn" size="small" @click.stop="onTrigger(row, $event)">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-dialog v-model="showPermissionDialog" :title="'角色权限 - ' + (currentRole?.role_name || currentRole?.name || '')" width="600px">
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

    <RowContextMenu :visible="visible" :position="position" :actions="currentRow ? getActions(currentRow) : []" @close="closeMenu" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { View, MoreFilled } from '@element-plus/icons-vue'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'
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

// 移动端溢出菜单
const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '查看权限', icon: View, onClick: () => handleViewPermissions(row) }
  ]
}

function onTrigger(row, event) {
  openMenu(row, event)
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

.action-btns-desktop { display: inline; }
.action-more-btn { display: none; }

@media (max-width: 768px) {
  .action-btns-desktop { display: none; }
  .action-more-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
    padding: 0 6px;
  }
}
</style>
