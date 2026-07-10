/**
 * 仓库 API 封装（通用版）
 */
import request from './index'

// 获取仓库列表
export function getRepoList(params) {
  return request({
    url: '/api/repos',
    method: 'get',
    params
  })
}

// 获取仓库详情
export function getRepoDetail(repoId) {
  return request({
    url: `/api/repos/${repoId}`,
    method: 'get'
  })
}

// 创建仓库
export function createRepo(data) {
  return request({
    url: '/api/repos',
    method: 'post',
    data
  })
}

// 更新仓库
export function updateRepo(repoId, data) {
  return request({
    url: `/api/repos/${repoId}`,
    method: 'put',
    data
  })
}

// 删除仓库
export function deleteRepo(repoId) {
  return request({
    url: `/api/repos/${repoId}`,
    method: 'delete'
  })
}

// 获取仓库成员
export function getRepoMembers(repoId) {
  return request({
    url: `/api/repos/${repoId}/members`,
    method: 'get'
  })
}

// 添加仓库成员
export function addRepoMember(repoId, data) {
  return request({
    url: `/api/repos/${repoId}/members`,
    method: 'post',
    data
  })
}

// 移除仓库成员
export function removeRepoMember(repoId, userId) {
  return request({
    url: `/api/repos/${repoId}/members/${userId}`,
    method: 'delete'
  })
}

// 获取仓库设置
export function getRepoSettings(repoId) {
  return request({
    url: `/api/repos/${repoId}/settings`,
    method: 'get'
  })
}

// 更新仓库设置
export function updateRepoSettings(repoId, data) {
  return request({
    url: `/api/repos/${repoId}/settings`,
    method: 'put',
    data
  })
}
