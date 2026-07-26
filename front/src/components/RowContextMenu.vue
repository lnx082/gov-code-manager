<template>
  <Teleport to="body">
    <div
      v-if="visible && actions.length > 0"
      class="row-context-menu"
      :style="menuStyle"
      @click.stop
    >
      <template v-for="(action, index) in filteredActions" :key="index">
        <div v-if="action.divided" class="menu-divider"></div>
        <div
          class="menu-item"
          :class="[action.type || '', { disabled: action.disabled }]"
          @click="handleAction(action)"
        >
          <el-icon v-if="action.icon" class="menu-item-icon"><component :is="action.icon" /></el-icon>
          <span class="menu-item-label">{{ action.label }}</span>
        </div>
      </template>
    </div>
    <!-- 遮罩层：点击任意位置关闭 -->
    <div v-if="visible" class="context-menu-overlay" @click.stop="handleOverlayClick"></div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  position: { type: Object, default: () => ({ x: 0, y: 0 }) },
  actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

/** 过滤掉 visible === false 的项 */
const filteredActions = computed(() =>
  props.actions.filter(a => a.visible !== false)
)

/** 动态计算菜单位置，防止溢出视口 */
const menuStyle = computed(() => {
  const menuW = 160
  const menuH = filteredActions.value.length * 40 + (filteredActions.value.filter(a => a.divided).length * 9) + 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = props.position.x
  let top = props.position.y

  // 水平边界检测
  if (left + menuW > vw - 8) {
    left = vw - menuW - 8
  }
  if (left < 8) left = 8

  // 垂直边界检测
  if (top + menuH > vh - 8) {
    top = top - menuH
  }
  if (top < 8) top = 8

  return {
    left: left + 'px',
    top: top + 'px'
  }
})

function handleAction(action) {
  if (action.disabled) return
  if (action.onClick) {
    action.onClick()
  }
  emit('close')
}

function handleOverlayClick() {
  emit('close')
}
</script>

<style lang="scss" scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: transparent;
}

.row-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 150px;
  max-width: 200px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 4px 0;
  animation: context-menu-in 0.15s ease-out;
}

@keyframes context-menu-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.menu-divider {
  height: 1px;
  margin: 4px 10px;
  background: #ebeef5;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background: #f5f5f5;
  }

  &:active {
    background: #e8e8e8;
  }

  .menu-item-icon {
    font-size: 15px;
    flex-shrink: 0;
    color: #606266;
  }

  .menu-item-label {
    flex: 1;
  }

  /* 危险操作 */
  &.danger {
    color: #c62828;
    .menu-item-icon { color: #c62828; }
    &:hover { background: #ffebee; }
  }

  /* 警告操作 */
  &.warning {
    color: #e65100;
    .menu-item-icon { color: #e65100; }
  }

  /* 成功操作 */
  &.success {
    color: #2e7d32;
    .menu-item-icon { color: #2e7d32; }
  }

  /* 禁用操作 */
  &.disabled {
    color: #c0c4cc;
    .menu-item-icon { color: #c0c4cc; }
    cursor: not-allowed;
    &:hover { background: transparent; }
  }
}
</style>
