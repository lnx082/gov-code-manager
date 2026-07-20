/**
 * 响应式断点检测 composable
 * 基于 window.matchMedia，无需外部依赖
 */
import { ref, onMounted, onUnmounted } from 'vue'

// 全局共享状态（所有组件实例共享同一份响应式状态）
const isMobile = ref(false)
const isTablet = ref(false)
const isDesktop = ref(true)
const breakpoint = ref('desktop')

let mqMobile = null
let mqDesktop = null
let refCount = 0

function update() {
  if (!mqMobile || !mqDesktop) return
  const m = mqMobile.matches        // width <= 768px
  const d = mqDesktop.matches       // width > 1024px
  isMobile.value = m
  isDesktop.value = d
  isTablet.value = !m && !d
  if (m) breakpoint.value = 'mobile'
  else if (d) breakpoint.value = 'desktop'
  else breakpoint.value = 'tablet'
}

export function useResponsive() {
  onMounted(() => {
    if (refCount === 0) {
      mqMobile = window.matchMedia('(max-width: 768px)')
      mqDesktop = window.matchMedia('(min-width: 1025px)')
      mqMobile.addEventListener('change', update)
      mqDesktop.addEventListener('change', update)
      update()
    }
    refCount++
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) {
      refCount = 0
      if (mqMobile) mqMobile.removeEventListener('change', update)
      if (mqDesktop) mqDesktop.removeEventListener('change', update)
      mqMobile = null
      mqDesktop = null
    }
  })

  return { isMobile, isTablet, isDesktop, breakpoint }
}
