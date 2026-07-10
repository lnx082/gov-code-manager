/**
 * 合并请求 API 封装
 */
import request from './index'

// 获取分支列表
export function getBranchList(owner, repo, params) {
  return request.get(`/branches/${owner}/${repo}/branches`, { params })
}

// 创建分支
export function createBranch(owner, repo, data) {
  return request.post(`/branches/${owner}/${repo}/branches`, data)
}

// 删除分支
export function deleteBranch(owner, repo, branch) {
  return request.delete(`/branches/${owner}/${repo}/branches/${branch}`)
}

// 获取合并请求列表
export function getMergeRequestList(owner, repo, params) {
  return request.get(`/branches/${owner}/${repo}/pullrequests`, { params })
}

// 创建合并请求
export function createMergeRequest(owner, repo, data) {
  return request.post(`/branches/${owner}/${repo}/pullrequests`, data)
}

// 合并合并请求
export function mergeMergeRequest(owner, repo, index, data) {
  return request.post(`/branches/${owner}/${repo}/pullrequests/${index}/merge`, data)
}

// 获取合并请求列表
export function getMergeRequestList(params) {
  return request.get('/approvals', { params: { ...params, type: 'merge' } })
}

// 创建合并请求
export function createMergeRequest(data) {
  return request.post('/approvals', { ...data, operationType: 'merge' })
}
