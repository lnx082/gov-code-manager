import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAuditLogs, getAuditLogDetail, getAuditStats, exportAuditLogs } from '@/api/bff'
import { getRiskWarnings, handleRiskWarning, getRiskWarningStats } from '@/api/bff'

export const useAuditStore = defineStore('audit', () => {
  const logs = ref([])
  const currentLog = ref(null)
  const stats = ref({
    byActionType: [],
    byResult: [],
    byUser: []
  })
  const riskWarnings = ref([])
  const warningStats = ref({
    byLevel: [],
    byStatus: [],
    byType: []
  })
  const loading = ref(false)
  const total = ref(0)

  async function fetchAuditLogs(params = {}) {
    loading.value = true
    try {
      const res = await getAuditLogs(params)
      logs.value = res.data.list || []
      total.value = res.data.total || 0
      return logs.value
    } finally {
      loading.value = false
    }
  }

  async function fetchAuditLogDetail(logId) {
    loading.value = true
    try {
      const res = await getAuditLogDetail(logId)
      currentLog.value = res.data
      return currentLog.value
    } finally {
      loading.value = false
    }
  }

  async function fetchAuditStats(params = {}) {
    const res = await getAuditStats(params)
    stats.value = res.data
    return stats.value
  }

  async function doExportAuditLogs(params) {
    const res = await exportAuditLogs(params)
    return res.data
  }

  async function fetchRiskWarnings(params = {}) {
    loading.value = true
    try {
      const res = await getRiskWarnings(params)
      riskWarnings.value = res.data.list || []
      total.value = res.data.total || 0
      return riskWarnings.value
    } finally {
      loading.value = false
    }
  }

  async function handleWarning(warningId, action, comment) {
    const res = await handleRiskWarning(warningId, { action, comment })
    return res.data
  }

  async function fetchWarningStats() {
    const res = await getRiskWarningStats()
    warningStats.value = res.data
    return warningStats.value
  }

  return {
    logs,
    currentLog,
    stats,
    riskWarnings,
    warningStats,
    loading,
    total,
    fetchAuditLogs,
    fetchAuditLogDetail,
    fetchAuditStats,
    doExportAuditLogs,
    fetchRiskWarnings,
    handleWarning,
    fetchWarningStats
  }
})
