/**
 * 版本 API 封装（Tag 中心）
 */
import request from './index'

// 获取版本列表
export function getVersionList(params) {
  return request.get('/versions', { params })
}

// 获取版本详情
export function getVersionDetail(tagName, params) {
  return request.get(`/versions/${encodeURIComponent(tagName)}`, { params })
}

// 创建版本
export function createVersion(data) {
  return request.post('/versions', data)
}

// 标记为基线
export function markAsBaseline(tagName, data) {
  return request.post(`/versions/${encodeURIComponent(tagName)}/baseline`, data)
}

// 获取基线列表
export function getBaselineList(params) {
  return request.get('/baselines', { params })
}

// 创建基线
export function createBaseline(data) {
  return request.post('/baselines', data)
}

// 锁定/解锁基线
export function lockBaseline(id, locked) {
  return request.post(`/baselines/${id}/lock`, { locked })
}

// 冻结基线
export function freezeBaseline(id) {
  return request.post(`/baselines/${id}/freeze`)
}

// 获取归档列表
export function getArchiveList(params) {
  return request.get('/archives', { params })
}

// 创建归档
export function createArchive(data) {
  return request.post('/archives', data)
}

// 恢复归档
export function restoreArchive(id) {
  return request.post(`/archives/${id}/restore`)
}

// 获取版本规则
export function getVersionRules() {
  return request.get('/version-rules')
}

// 更新版本规则
export function updateVersionRules(data) {
  return request.put('/version-rules', data)
}

// 验证版本号
export function validateVersion(version) {
  return request.post('/version-rules/validate', { version })
}
