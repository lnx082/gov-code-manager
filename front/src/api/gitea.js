import { giteaService } from './index'

/**
 * Gitea API 封装
 * 用于 Git 原生操作（仓库、分支、Tag、PR、提交、文件）
 */

// ============ 用户认证 ============

export function getCurrentUser() {
  return giteaService.get('/user')
}

export function searchUsers(query) {
  return giteaService.get('/users/search', { params: { q: query } })
}

// ============ 仓库管理 ============

export function getMyRepos(params = {}) {
  return giteaService.get('/user/repos', { params })
}

export function getRepos(params = {}) {
  return giteaService.get('/repos/search', { params })
}

export function getRepo(owner, repo) {
  return giteaService.get(`/repos/${owner}/${repo}`)
}

export function createRepo(data) {
  return giteaService.post('/user/repos', data)
}

export function updateRepo(owner, repo, data) {
  return giteaService.patch(`/repos/${owner}/${repo}`, data)
}

export function deleteRepo(owner, repo) {
  return giteaService.delete(`/repos/${owner}/${repo}`)
}

export function getRepoMembers(owner, repo) {
  return giteaService.get(`/repos/${owner}/${repo}/collaborators`)
}

export function addRepoMember(owner, repo, collaborator, permission = 'push') {
  return giteaService.put(`/repos/${owner}/${repo}/collaborators/${collaborator}`, { permission })
}

export function removeRepoMember(owner, repo, collaborator) {
  return giteaService.delete(`/repos/${owner}/${repo}/collaborators/${collaborator}`)
}

// ============ 分支管理 ============

export function getBranches(owner, repo, params = {}) {
  return giteaService.get(`/repos/${owner}/${repo}/branches`, { params })
}

export function getBranch(owner, repo, branch) {
  return giteaService.get(`/repos/${owner}/${repo}/branches/${branch}`)
}

export function createBranch(owner, repo, data) {
  // Gitea API: POST /repos/{owner}/{repo}/branches
  // 参数: new_branch_name (新分支名), old_branch_name (基于的分支)
  return giteaService.post(`/repos/${owner}/${repo}/branches`, {
    new_branch_name: data.new_branch_name || data.new_branch,
    old_branch_name: data.old_branch_name || data.old_branch
  })
}

export function deleteBranch(owner, repo, branch) {
  return giteaService.delete(`/repos/${owner}/${repo}/branches/${branch}`)
}

export function getBranchProtection(owner, repo, branch) {
  return giteaService.get(`/repos/${owner}/${repo}/branch_protections/${branch}`)
}

export function updateBranchProtection(owner, repo, branch, data) {
  return giteaService.put(`/repos/${owner}/${repo}/branch_protections/${branch}`, data)
}

// ============ Tag/版本管理 ============

export function getTags(owner, repo, params = {}) {
  return giteaService.get(`/repos/${owner}/${repo}/tags`, { params })
}

export function getTag(owner, repo, tag) {
  return giteaService.get(`/repos/${owner}/${repo}/tags/${tag}`)
}

export function createTag(owner, repo, data) {
  return giteaService.post(`/repos/${owner}/${repo}/tags`, data)
}

export function deleteTag(owner, repo, tag) {
  return giteaService.delete(`/repos/${owner}/${repo}/tags/${tag}`)
}

export function getReleases(owner, repo, params = {}) {
  return giteaService.get(`/repos/${owner}/${repo}/releases`, { params })
}

export function createRelease(owner, repo, data) {
  return giteaService.post(`/repos/${owner}/${repo}/releases`, data)
}

// ============ 提交历史 ============

export function getCommits(owner, repo, params = {}) {
  return giteaService.get(`/repos/${owner}/${repo}/commits`, { params })
}

export function getCommit(owner, repo, sha) {
  return giteaService.get(`/repos/${owner}/${repo}/git/commits/${sha}`)
}

export function getCommitStatus(owner, repo, sha) {
  return giteaService.get(`/repos/${owner}/${repo}/statuses/${sha}`)
}

// ============ 差异对比 ============

export function compareRepos(owner, repo, base, head) {
  return giteaService.get(`/repos/${owner}/${repo}/compare/${base}...${head}`)
}

// 获取提交差异（服务端计算）
export function getCommitDiff(owner, repo, sha) {
  return giteaService.get(`/commit-diff/${owner}/${repo}/${sha}`)
}

// ============ 文件操作 ============

export function getContents(owner, repo, path = '', ref = '') {
  const params = ref ? { ref } : {}
  return giteaService.get(`/repos/${owner}/${repo}/contents/${path}`, { params })
}

export function getFileContent(owner, repo, path, ref = '') {
  return giteaService.get(`/repos/${owner}/${repo}/raw/${path}`, { params: { ref } })
}

export function getTree(owner, repo, sha = 'main', recursive = true) {
  return giteaService.get(`/repos/${owner}/${repo}/git/trees/${sha}`, { params: { recursive } })
}

export function getBlobs(owner, repo, sha, paths) {
  return giteaService.post(`/repos/${owner}/${repo}/git/blobs`, {
    sha,
    paths
  })
}

// ============ 合并请求 (Pull Requests) ============

export function getPullRequests(owner, repo, params = {}) {
  return giteaService.get(`/repos/${owner}/${repo}/pulls`, { params })
}

export function getPullRequest(owner, repo, index) {
  return giteaService.get(`/repos/${owner}/${repo}/pulls/${index}`)
}

export function createPullRequest(owner, repo, data) {
  return giteaService.post(`/repos/${owner}/${repo}/pulls`, data)
}

export function updatePullRequest(owner, repo, index, data) {
  return giteaService.patch(`/repos/${owner}/${repo}/pulls/${index}`, data)
}

export function mergePullRequest(owner, repo, index, data = {}) {
  // Gitea API 要求 do 参数: merge / rebase / squash / manually-merged
  if (!data.do) data.do = 'merge'
  return giteaService.post(`/repos/${owner}/${repo}/pulls/${index}/merge`, data)
}

export function closePullRequest(owner, repo, index) {
  return giteaService.patch(`/repos/${owner}/${repo}/pulls/${index}`, { state: 'closed' })
}

// ============ PR 审批 (Gitea 原生) ============

/**
 * 提交 PR 审批
 * @param {string} owner - 仓库拥有者
 * @param {string} repo - 仓库名
 * @param {number} index - PR 编号
 * @param {object} data - { event: 'APPROVE' | 'REJECT' | 'COMMENT', body?: string }
 */
export function submitPullRequestReview(owner, repo, index, data) {
  // Gitea API: POST /repos/{owner}/{repo}/pulls/{index}/reviews
  // event: APPROVE (通过), REJECT (拒绝), COMMENT (评论)
  // 注意：Gitea 要求 APPROVE/REJECT 必须填写审批意见（body）
  return giteaService.post(`/repos/${owner}/${repo}/pulls/${index}/reviews`, {
    event: data.event || 'APPROVE',
    body: data.body || data.comment || ''
  })
}

/**
 * 获取 PR 审批状态
 * @param {string} owner - 仓库拥有者
 * @param {string} repo - 仓库名
 * @param {number} index - PR 编号
 */
export function getPullRequestReviews(owner, repo, index) {
  return giteaService.get(`/repos/${owner}/${repo}/pulls/${index}/reviews`)
}

// ============ PR 评论 ============

export function getPullRequestCommits(owner, repo, index) {
  return giteaService.get(`/repos/${owner}/${repo}/pulls/${index}/commits`)
}

export function getPullRequestFiles(owner, repo, index) {
  return giteaService.get(`/repos/${owner}/${repo}/pulls/${index}/files`)
}

export function isPRMerged(owner, repo, index) {
  return giteaService.get(`/repos/${owner}/${repo}/pulls/${index}/merge`)
}

// ============ 仓库签名 ============

export function getKey(owner, repo) {
  return giteaService.get(`/repos/${owner}/${repo}/keys`)
}

export function createKey(owner, repo, data) {
  return giteaService.post(`/repos/${owner}/${repo}/keys`, data)
}

export function deleteKey(owner, repo, id) {
  return giteaService.delete(`/repos/${owner}/${repo}/keys/${id}`)
}

// ============ 组织/团队 ============

export function getMyOrgs() {
  return giteaService.get('/user/orgs')
}

export function getOrgRepos(org, params = {}) {
  return giteaService.get(`/orgs/${org}/repos`, { params })
}

// ============ 搜索 ============

export function searchRepos(query, params = {}) {
  return giteaService.get('/repos/search', { params: { q: query, ...params } })
}

export function searchIssues(query, params = {}) {
  return giteaService.get('/repos/issues/search', { params: { q: query, ...params } })
}
