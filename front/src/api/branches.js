import request from './request'

// 获取分支列表
export function getBranchList(repoId, params) {
  return request({
    url: `/api/repos/${repoId}/branches`,
    method: 'get',
    params
  })
}

// 获取分支详情
export function getBranchDetail(repoId, branchName) {
  return request({
    url: `/api/repos/${repoId}/branches/${encodeURIComponent(branchName)}`,
    method: 'get'
  })
}

// 创建分支
export function createBranch(repoId, data) {
  return request({
    url: `/api/repos/${repoId}/branches`,
    method: 'post',
    data
  })
}

// 删除分支
export function deleteBranch(repoId, branchName) {
  return request({
    url: `/api/repos/${repoId}/branches/${encodeURIComponent(branchName)}`,
    method: 'delete'
  })
}

// 保护分支
export function protectBranch(repoId, branchName, data) {
  return request({
    url: `/api/repos/${repoId}/branches/${encodeURIComponent(branchName)}/protect`,
    method: 'post',
    data
  })
}

// 取消保护分支
export function unprotectBranch(repoId, branchName) {
  return request({
    url: `/api/repos/${repoId}/branches/${encodeURIComponent(branchName)}/protect`,
    method: 'delete'
  })
}

// 获取合并请求列表
export function getMergeRequestList(repoId, params) {
  return request({
    url: `/api/repos/${repoId}/merge-requests`,
    method: 'get',
    params
  })
}

// 获取合并请求详情
export function getMergeRequestDetail(repoId, mrId) {
  return request({
    url: `/api/repos/${repoId}/merge-requests/${mrId}`,
    method: 'get'
  })
}

// 创建合并请求
export function createMergeRequest(repoId, data) {
  return request({
    url: `/api/repos/${repoId}/merge-requests`,
    method: 'post',
    data
  })
}

// 更新合并请求
export function updateMergeRequest(repoId, mrId, data) {
  return request({
    url: `/api/repos/${repoId}/merge-requests/${mrId}`,
    method: 'put',
    data
  })
}

// 合并请求操作
export function handleMergeRequest(repoId, mrId, action, data) {
  return request({
    url: `/api/repos/${repoId}/merge-requests/${mrId}/${action}`,
    method: 'post',
    data
  })
}

// 获取分支差异
export function getBranchDiff(repoId, source, target) {
  return request({
    url: `/api/repos/${repoId}/branches/diff`,
    method: 'get',
    params: { source, target }
  })
}
