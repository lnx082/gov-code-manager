import request from './index'

// 获取版本列表
export function getVersionList(params) {
  return request({
    url: '/api/versions',
    method: 'get',
    params
  })
}

// 获取版本详情
export function getVersionDetail(versionId) {
  return request({
    url: `/api/versions/${versionId}`,
    method: 'get'
  })
}

// 创建版本
export function createVersion(data) {
  return request({
    url: '/api/versions',
    method: 'post',
    data
  })
}

// 更新版本
export function updateVersion(versionId, data) {
  return request({
    url: `/api/versions/${versionId}`,
    method: 'put',
    data
  })
}

// 删除版本
export function deleteVersion(versionId) {
  return request({
    url: `/api/versions/${versionId}`,
    method: 'delete'
  })
}

// 发布版本
export function releaseVersion(versionId) {
  return request({
    url: `/api/versions/${versionId}/release`,
    method: 'post'
  })
}

// 获取版本文件列表
export function getVersionFiles(versionId) {
  return request({
    url: `/api/versions/${versionId}/files`,
    method: 'get'
  })
}

// 下载版本文件
export function downloadVersionFile(versionId, fileId) {
  return request({
    url: `/api/versions/${versionId}/files/${fileId}/download`,
    method: 'get',
    responseType: 'blob'
  })
}

// 获取版本历史
export function getVersionHistory(versionId) {
  return request({
    url: `/api/versions/${versionId}/history`,
    method: 'get'
  })
}

// 申请基线版本
export function applyBaseline(data) {
  return request({
    url: '/api/versions/baseline/apply',
    method: 'post',
    data
  })
}

// 获取基线版本列表
export function getBaselineList(params) {
  return request({
    url: '/api/versions/baseline',
    method: 'get',
    params
  })
}
