import request from './index'

// 获取审批列表
export function getApprovalList(params) {
  return request.get('/approvals', { params })
}

// 获取待审批列表
export function getPendingApprovals(params) {
  return request.get('/approvals/pending', { params })
}

// 获取我的申请列表
export function getMyApprovals(params) {
  return request.get('/approvals', { params: { ...params, applicantUserId: 'me' } })
}

// 获取审批详情
export function getApprovalDetail(id) {
  return request.get(`/approvals/${id}`)
}

// 按 Gitea PR 编号查询审批状态（BFF 回退查询）
export function getApprovalByPrNumber(prNumber) {
  return request.get(`/approvals/by-pr/${prNumber}`)
}

// 创建审批申请
export function createApproval(data) {
  return request.post('/approvals', data)
}

// 处理审批
export function processApproval(id, data) {
  return request.post(`/approvals/${id}/process`, data)
}

// 审批通过
export function approveApproval(id, comment) {
  return request.post(`/approvals/${id}/process`, { action: 'approved', comment })
}

// 审批拒绝
export function rejectApproval(id, comment) {
  return request.post(`/approvals/${id}/process`, { action: 'rejected', comment })
}

// 获取审批统计
export function getApprovalStats() {
  return request.get('/approvals/stats/summary')
}

// 获取审批流程列表
export function getApprovalFlows() {
  return request.get('/approval-flows')
}

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

// 获取分支列表
export function getBranchList(params) {
  return request.get('/repos', { params })
}

// 获取合并请求列表
export function getMergeRequestList(params) {
  return request.get('/merge-requests', { params })
}

// 创建合并请求
export function createMergeRequest(data) {
  return request.post('/merge-requests', data)
}

// 获取风险预警列表
export function getRiskWarnings(params) {
  return request.get('/risk-warnings', { params })
}

// 处理风险预警
export function handleRiskWarning(id, data) {
  return request.post(`/risk-warnings/${id}/handle`, data)
}

// 获取合并请求列表（BFF 主数据源，不依赖 Gitea）
export function getMergeApprovals(params) {
  return request.get('/approvals/merge-requests', { params })
}
