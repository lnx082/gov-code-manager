import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRepoList, getRepoDetail } from '@/api/repo'

export const useRepoStore = defineStore('repo', () => {
  const repos = ref([])
  const currentRepo = ref(null)
  const loading = ref(false)

  async function fetchRepos(params = {}) {
    loading.value = true
    try {
      const res = await getRepoList(params)
      repos.value = res.data.list || res.data
      return repos.value
    } finally {
      loading.value = false
    }
  }

  async function fetchRepoDetail(id) {
    loading.value = true
    try {
      const res = await getRepoDetail(id)
      currentRepo.value = res.data
      return currentRepo.value
    } finally {
      loading.value = false
    }
  }

  return {
    repos,
    currentRepo,
    loading,
    fetchRepos,
    fetchRepoDetail
  }
})
