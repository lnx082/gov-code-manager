/**
 * 基线/归档状态管理
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getBaselines, getBaselineDetail, createBaseline, lockBaseline, unlockBaseline, deleteBaseline } from '@/api/bff'
import { getArchives, createArchive, restoreArchive } from '@/api/bff'

export const useBaselineStore = defineStore('baseline', () => {
  const baselines = ref([])
  const archives = ref([])
  const currentBaseline = ref(null)
  const loading = ref(false)
  const total = ref(0)

  async function fetchBaselines(params = {}) {
    loading.value = true
    try {
      const res = await getBaselines(params)
      baselines.value = res.data.list || []
      total.value = res.data.total || 0
      return baselines.value
    } finally {
      loading.value = false
    }
  }

  async function fetchBaselineDetail(baselineId) {
    loading.value = true
    try {
      const res = await getBaselineDetail(baselineId)
      currentBaseline.value = res.data
      return currentBaseline.value
    } finally {
      loading.value = false
    }
  }

  async function addBaseline(data) {
    const res = await createBaseline(data)
    return res.data
  }

  async function lock(baselineId) {
    await lockBaseline(baselineId)
  }

  async function unlock(baselineId) {
    await unlockBaseline(baselineId)
  }

  async function remove(baselineId) {
    await deleteBaseline(baselineId)
  }

  async function fetchArchives(params = {}) {
    loading.value = true
    try {
      const res = await getArchives(params)
      archives.value = res.data.list || []
      total.value = res.data.total || 0
      return archives.value
    } finally {
      loading.value = false
    }
  }

  async function addArchive(data) {
    const res = await createArchive(data)
    return res.data
  }

  async function restore(archiveId) {
    await restoreArchive(archiveId)
  }

  return {
    baselines,
    archives,
    currentBaseline,
    loading,
    total,
    fetchBaselines,
    fetchBaselineDetail,
    addBaseline,
    lock,
    unlock,
    remove,
    fetchArchives,
    addArchive,
    restore
  }
})
