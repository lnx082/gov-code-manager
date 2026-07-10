/**
 * 系统状态管理（仪表盘统计/系统状态）
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDashboardStats, getTrends, getDistribution } from '@/api/bff'
import { getSystemConfig, getSystemStatus } from '@/api/bff'

export const useSystemStore = defineStore('system', () => {
  const dashboardStats = ref({
    repoCount: 0,
    versionCount: 0,
    pendingApprovals: 0,
    activeBaselines: 0,
    unhandledWarnings: 0,
    monthlyApprovals: 0
  })
  const trends = ref([])
  const distribution = ref({
    byOperationType: [],
    byStatus: []
  })
  const systemStatus = ref(null)
  const loading = ref(false)

  async function fetchDashboardStats() {
    loading.value = true
    try {
      const res = await getDashboardStats()
      dashboardStats.value = res.data
      return dashboardStats.value
    } finally {
      loading.value = false
    }
  }

  async function fetchTrends(params = {}) {
    const res = await getTrends(params)
    trends.value = res.data.data || []
    return trends.value
  }

  async function fetchDistribution() {
    const res = await getDistribution()
    distribution.value = res.data
    return distribution.value
  }

  async function fetchSystemStatus() {
    const res = await getSystemStatus()
    systemStatus.value = res.data
    return systemStatus.value
  }

  return {
    dashboardStats,
    trends,
    distribution,
    systemStatus,
    loading,
    fetchDashboardStats,
    fetchTrends,
    fetchDistribution,
    fetchSystemStatus
  }
})
