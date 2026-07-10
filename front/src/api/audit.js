/**
 * 审计相关 API 封装
 */
import request from './index'

// 获取审计日志列表
export function getAuditLogs(params) {
  return request.get('/audit/logs', { params })
}

// 获取审计日志详情
export function getAuditLogDetail(id) {
  return request.get(`/audit/logs/${id}`)
}

// 验证日志完整性
export function verifyLogIntegrity(data) {
  return request.post('/audit/logs/verify-integrity', data)
}

// 获取操作统计
export function getOperationStats(params) {
  return request.get('/audit/stats/operations', { params })
}

// 获取用户操作统计
export function getUserStats(params) {
  return request.get('/audit/stats/users', { params })
}

// 获取风险预警列表
export function getRiskWarnings(params) {
  return request.get('/risk-warnings', { params })
}

// 处理风险预警
export function handleRiskWarning(id, data) {
  return request.post(`/risk-warnings/${id}/handle`, data)
}

// 获取报表列表
export function getAuditReports(params) {
  return request.get('/reports', { params })
}

// 生成报表
export function generateReport(data) {
  return request.post('/reports/generate', data)
}

// 下载报表
export function downloadReportFile(id) {
  return request.get(`/reports/${id}/export`, { responseType: 'blob' })
}

// 合规检查
export function complianceCheck(data) {
  return request.post('/compliance/check', data)
}

// 导出审计日志（CSV下载）
export function exportAuditLogs(params) {
  return request.get('/audit/export', { params, responseType: 'blob' })
}
