import { bffService } from './index'

/**
 * BFF API 封装
 * 用于业务逻辑（审批、权限、审计、基线、归档、报表、风险监控）
 */

// ============ 版本编号规则 ============

export function getVersionRules() {
  return bffService.get('/version-rules')
}

export function updateVersionRules(data) {
  return bffService.put('/version-rules', data)
}

export function validateVersion(data) {
  return bffService.post('/version-rules/validate', data)
}

export function getNextVersion(params) {
  return bffService.get('/version-rules/next-version', { params })
}

// ============ 审批流程 ============

export function getApprovalFlows(params) {
  return bffService.get('/approval-flows', { params })
}

export function getApprovalFlow(flowId) {
  return bffService.get(`/approval-flows/${flowId}`)
}

export function createApprovalFlow(data) {
  return bffService.post('/approval-flows', data)
}

export function updateApprovalFlow(flowId, data) {
  return bffService.put(`/approval-flows/${flowId}`, data)
}

export function deleteApprovalFlow(flowId) {
  return bffService.delete(`/approval-flows/${flowId}`)
}

export function getSuggestedFlows(params) {
  return bffService.get('/approval-flows/suggest/list', { params })
}

// ============ 审批申请 ============

export function createApproval(data) {
  return bffService.post('/approvals', data)
}

export function getPendingApprovals(params) {
  return bffService.get('/approvals/pending', { params })
}

export function getMyApprovalRequests(params) {
  return bffService.get('/approvals/my-requests', { params })
}

export function getApprovalDetail(approvalId) {
  return bffService.get(`/approvals/${approvalId}`)
}

export function processApproval(approvalId, data) {
  return bffService.post(`/approvals/${approvalId}/process`, data)
}

export function withdrawApproval(approvalId) {
  return bffService.post(`/approvals/${approvalId}/withdraw`)
}

// ============ 合规检查 ============

export function complianceCheck(data) {
  return bffService.post('/compliance/check', data)
}

// ============ 基线管理 ============

export function getBaselines(params) {
  return bffService.get('/baselines', { params })
}

export function getBaselineDetail(baselineId) {
  return bffService.get(`/baselines/${baselineId}`)
}

export function createBaseline(data) {
  return bffService.post('/baselines', data)
}

export function updateBaseline(baselineId, data) {
  return bffService.put(`/baselines/${baselineId}`, data)
}

export function lockBaseline(baselineId) {
  return bffService.post(`/baselines/${baselineId}/lock`)
}

export function unlockBaseline(baselineId) {
  return bffService.post(`/baselines/${baselineId}/unlock`)
}

export function deleteBaseline(baselineId) {
  return bffService.delete(`/baselines/${baselineId}`)
}

// ============ 归档管理 ============

export function getArchives(params) {
  return bffService.get('/archives', { params })
}

export function getArchiveDetail(archiveId) {
  return bffService.get(`/archives/${archiveId}`)
}

export function createArchive(data) {
  return bffService.post('/archives', data)
}

export function restoreArchive(archiveId) {
  return bffService.post(`/archives/${archiveId}/restore`)
}

export function deleteArchive(archiveId) {
  return bffService.delete(`/archives/${archiveId}`)
}

// ============ 版本废弃 ============

export function getDeprecations(params) {
  return bffService.get('/version-deprecations', { params })
}

export function getDeprecationDetail(deprecationId) {
  return bffService.get(`/version-deprecations/${deprecationId}`)
}

export function createDeprecation(data) {
  return bffService.post('/version-deprecations', data)
}

// ============ 用户管理 ============

export function getUserList(params) {
  return bffService.get('/users', { params })
}

export function getUserDetail(userId) {
  return bffService.get(`/users/${userId}`)
}

export function createUser(data) {
  return bffService.post('/users', data)
}

export function updateUser(userId, data) {
  return bffService.put(`/users/${userId}`, data)
}

export function deleteUser(userId) {
  return bffService.delete(`/users/${userId}`)
}

export function lockUser(userId, locked) {
  return bffService.post(`/users/${userId}/lock`, { locked })
}

export function resetUserPassword(userId, data) {
  return bffService.post(`/users/${userId}/reset-password`, data)
}

export function getCurrentUser() {
  return bffService.get('/users/me')
}

// ============ 角色管理 ============

export function getRoles(params) {
  return bffService.get('/roles', { params })
}

export function getRoleDetail(roleId) {
  return bffService.get(`/roles/${roleId}`)
}

export function createRole(data) {
  return bffService.post('/roles', data)
}

export function updateRole(roleId, data) {
  return bffService.put(`/roles/${roleId}`, data)
}

export function deleteRole(roleId) {
  return bffService.delete(`/roles/${roleId}`)
}

export function getAllPermissions() {
  return bffService.get('/roles/permissions/all')
}

export function getDefaultPermissions(params) {
  return bffService.get('/roles/default-permissions', { params })
}

// ============ 权限定义 ============

export function getPermissions() {
  return bffService.get('/permissions')
}

// ============ 部门管理 ============

export function getDepartments(params) {
  return bffService.get('/departments', { params })
}

export function getDepartmentUsers(deptId) {
  return bffService.get(`/departments/${deptId}/users`)
}

export function createDepartment(data) {
  return bffService.post('/departments', data)
}

export function updateDepartment(deptId, data) {
  return bffService.put(`/departments/${deptId}`, data)
}

export function deleteDepartment(deptId) {
  return bffService.delete(`/departments/${deptId}`)
}

// ============ 会话管理 ============

export function getSessions(params) {
  return bffService.get('/sessions', { params })
}

export function createSession(data) {
  return bffService.post('/sessions', data)
}

export function deleteSession(sessionId) {
  return bffService.delete(`/sessions/${sessionId}`)
}

export function refreshSession(sessionId) {
  return bffService.put(`/sessions/${sessionId}/refresh`)
}

// ============ 审计日志 ============

export function getAuditLogs(params) {
  return bffService.get('/audit/logs', { params })
}

export function getAuditLogDetail(logId) {
  return bffService.get(`/audit/logs/${logId}`)
}

export function verifyAuditChain(data) {
  return bffService.post('/audit/verify', data)
}

export function getAuditStats(params) {
  return bffService.get('/audit/stats/operations', { params })
}

export function exportAuditLogs(data) {
  return bffService.post('/audit/export', data)
}

// ============ 审计报表 ============

export function getReports(params) {
  return bffService.get('/reports', { params })
}

export function generateReport(data) {
  return bffService.post('/reports/generate', data)
}

export function downloadReport(reportId) {
  return bffService.get(`/reports/${reportId}/download`)
}

export function deleteReport(reportId) {
  return bffService.delete(`/reports/${reportId}`)
}

export function getReportTemplates() {
  return bffService.get('/reports/templates/list')
}

// ============ 备份管理 ============

export function getBackups(params) {
  return bffService.get('/backups', { params })
}

export function getBackupDetail(backupId) {
  return bffService.get(`/backups/${backupId}`)
}

export function createBackup(data) {
  return bffService.post('/backups', data)
}

export function restoreBackup(backupId) {
  return bffService.post(`/backups/${backupId}/restore`)
}

export function deleteBackup(backupId) {
  return bffService.delete(`/backups/${backupId}`)
}

// ============ 完整性校验 ============

export function triggerIntegrityCheck(data) {
  return bffService.post('/integrity/check', data)
}

export function getIntegrityResults(params) {
  return bffService.get('/integrity/results', { params })
}

// ============ 风险预警 ============

export function getRiskWarnings(params) {
  return bffService.get('/risk-warnings', { params })
}

export function handleRiskWarning(warningId, data) {
  return bffService.post(`/risk-warnings/${warningId}/handle`, data)
}

export function getRiskWarningStats() {
  return bffService.get('/risk-warnings/stats/summary')
}

// ============ 通知 ============

export function getNotifications(params) {
  return bffService.get('/notifications', { params })
}

export function markNotificationRead(notificationId) {
  return bffService.post(`/notifications/${notificationId}/read`)
}

export function markAllNotificationsRead() {
  return bffService.post('/notifications/read-all')
}

export function publishNotification(data) {
  return bffService.post('/notifications', data)
}

export function deleteNotification(notificationId) {
  return bffService.delete(`/notifications/${notificationId}`)
}

// ============ 系统配置 ============

export function getSystemConfig() {
  return bffService.get('/system/config')
}

export function updateSystemConfig(data) {
  return bffService.put('/system/config', data)
}

export function getSystemStatus() {
  return bffService.get('/system/status')
}

// ============ 统计看板 ============

export function getDashboardStats() {
  return bffService.get('/statistics/dashboard')
}

export function getTrends(params) {
  return bffService.get('/statistics/trends', { params })
}

export function getDistribution() {
  return bffService.get('/statistics/distribution')
}

// ============ 仓库列表（带权限过滤） ============

export function getFilteredRepos(params) {
  return bffService.get('/repos', { params })
}

// 批量获取文件最后提交信息
export function getLastCommits(owner, repo, data) {
  return bffService.post(`/repos/${owner}/${repo}/last-commits`, data)
}

// ============ 下载令牌 ============

export function getDownloadToken() {
  return bffService.get('/user/download-token')
}
