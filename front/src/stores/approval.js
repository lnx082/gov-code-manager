/**
 * 审批状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPendingApprovals, getMyApprovalRequests, getApprovalDetail, createApproval, processApproval, withdrawApproval } from '@/api/bff'

export const useApprovalStore = defineStore('approval', () => {
  const pendingList = ref([])
  const myRequests = ref([])
  const currentApproval = ref(null)
  const loading = ref(false)
  const total = ref(0)

  const pendingCount = computed(() => pendingList.value.length)

  async function fetchPendingApprovals(params = {}) {
    loading.value = true
    try {
      const res = await getPendingApprovals(params)
      pendingList.value = res.data.list || []
      total.value = res.data.total || 0
      return pendingList.value
    } finally {
      loading.value = false
    }
  }

  async function fetchMyRequests(params = {}) {
    loading.value = true
    try {
      const res = await getMyApprovalRequests(params)
      myRequests.value = res.data.list || []
      total.value = res.data.total || 0
      return myRequests.value
    } finally {
      loading.value = false
    }
  }

  async function fetchApprovalDetail(approvalId) {
    loading.value = true
    try {
      const res = await getApprovalDetail(approvalId)
      currentApproval.value = res.data
      return currentApproval.value
    } finally {
      loading.value = false
    }
  }

  async function submitApproval(data) {
    const res = await createApproval(data)
    return res.data
  }

  async function approve(approvalId, action, comment) {
    const res = await processApproval(approvalId, { action, comment })
    return res.data
  }

  async function withdraw(approvalId) {
    await withdrawApproval(approvalId)
  }

  return {
    pendingList,
    myRequests,
    currentApproval,
    loading,
    total,
    pendingCount,
    fetchPendingApprovals,
    fetchMyRequests,
    fetchApprovalDetail,
    submitApproval,
    approve,
    withdraw
  }
})
