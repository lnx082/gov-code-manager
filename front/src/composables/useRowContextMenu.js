/**
 * 表格行右击/长按弹出菜单 composable
 * 管理浮动菜单的状态和定位
 */
import { ref, reactive } from 'vue'

export function useRowContextMenu() {
  const visible = ref(false)
  const position = reactive({ x: 0, y: 0 })
  const currentRow = ref(null)

  /** 打开菜单：根据事件定位，自动处理边缘检测 */
  function openMenu(row, event) {
    // 阻止默认右键菜单
    if (event && event.preventDefault) {
      event.preventDefault()
    }

    currentRow.value = row

    // 获取点击坐标（兼容 MouseEvent 和 Touch）
    let clientX, clientY
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX
      clientY = event.touches[0].clientY
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX
      clientY = event.changedTouches[0].clientY
    } else {
      clientX = event.clientX
      clientY = event.clientY
    }

    position.x = clientX
    position.y = clientY
    visible.value = true

    // 下次点击任意位置自动关闭
    setTimeout(() => {
      document.addEventListener('click', closeMenu, { once: true })
      document.addEventListener('contextmenu', closeMenu, { once: true })
    }, 0)
  }

  /** 关闭菜单 */
  function closeMenu() {
    visible.value = false
    currentRow.value = null
  }

  return { visible, position, currentRow, openMenu, closeMenu }
}
