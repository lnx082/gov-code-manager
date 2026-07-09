import request from './index'

// ===== 角色管理 =====
export function getRoleList() {
  return request.get('/roles')
}

export function getRoleDetail(code) {
  return request.get(`/roles/${code}`)
}

export function createRole(data) {
  return request.post('/roles', data)
}

export function updateRole(code, data) {
  return request.put(`/roles/${code}`, data)
}

export function deleteRole(code) {
  return request.delete(`/roles/${code}`)
}

// ===== 部门管理 =====
export function getDeptList(params) {
  return request.get('/departments', { params })
}

export function getDeptDetail(id) {
  return request.get(`/departments/${id}`)
}

export function createDept(data) {
  return request.post('/departments', data)
}

export function updateDept(id, data) {
  return request.put(`/departments/${id}`, data)
}

export function deleteDept(id) {
  return request.delete(`/departments/${id}`)
}

// ===== 备份管理 =====
export function getBackupList(params) {
  return request.get('/backups', { params })
}

export function createBackup(data) {
  return request.post('/backups', data)
}

export function restoreBackup(id) {
  return request.post(`/backups/${id}/restore`)
}

export function deleteBackup(id) {
  return request.delete(`/backups/${id}`)
}

// ===== 系统配置 =====
export function getSystemConfig() {
  return request.get('/system/config')
}

export function updateSystemConfig(data) {
  return request.put('/system/config', data)
}

export function getSystemStatus() {
  return request.get('/system/status')
}

// ===== 权限列表 =====
export function getPermissions() {
  return request.get('/permissions')
}

// ===== 基线管理 =====
export function getBaselineList(params) {
  return request.get('/baselines', { params })
}

export function getBaselineDetail(id) {
  return request.get(`/baselines/${id}`)
}

export function createBaseline(data) {
  return request.post('/baselines', data)
}

export function lockBaseline(id, locked) {
  return request.post(`/baselines/${id}/lock`, { locked })
}

export function freezeBaseline(id) {
  return request.post(`/baselines/${id}/freeze`)
}

// ===== 版本管理 =====
export function getVersionList(params) {
  return request.get('/versions', { params })
}

export function createVersion(data) {
  return request.post('/versions', data)
}

export function markAsBaseline(tagName, data) {
  return request.post(`/versions/${encodeURIComponent(tagName)}/baseline`, data)
}

// ===== 版本规则 =====
export function getVersionRules() {
  return request.get('/version-rules')
}

export function updateVersionRules(data) {
  return request.put('/version-rules', data)
}

export function validateVersion(version) {
  return request.post('/version-rules/validate', { version })
}

// ===== 归档管理 =====
export function getArchiveList(params) {
  return request.get('/archives', { params })
}

export function createArchive(data) {
  return request.post('/archives', data)
}

export function restoreArchive(id) {
  return request.post(`/archives/${id}/restore`)
}

// ===== 通知 =====
export function getNotifications(params) {
  return request.get('/notifications', { params })
}

export function markNotificationRead(id) {
  return request.post(`/notifications/${id}/read`)
}

export function markAllNotificationsRead() {
  return request.post('/notifications/read-all')
}

// ===== 统计 =====
export function getDashboardStats() {
  return request.get('/statistics/dashboard')
}

export function getTrendData(params) {
  return request.get('/statistics/trends', { params })
}

// ===== 合规检查 =====
export function complianceCheck(data) {
  return request.post('/compliance/check', data)
}
