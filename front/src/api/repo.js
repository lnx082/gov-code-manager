import request from './index'

// 获取仓库列表
export function getRepoList(params) {
  return request.get('/repos', { params })
}

// 获取单个仓库详情
export function getRepoDetail(owner, repo) {
  return request.get(`/repos/${owner}/${repo}`)
}

// 获取仓库文件列表
export function getRepoContents(owner, repo, params) {
  return request.get(`/repos/${owner}/${repo}/contents`, { params })
}

// 获取仓库分支列表
export function getRepoBranches(owner, repo, params) {
  return request.get(`/repos/${owner}/${repo}/branches`, { params })
}

// 获取提交历史
export function getCommits(owner, repo, params) {
  return request.get(`/repos/${owner}/${repo}/commits`, { params })
}

// 获取提交详情
export function getCommitDetail(owner, repo, sha) {
  return request.get(`/repos/${owner}/${repo}/commits/${sha}`)
}

// 获取差异对比
export function getCompare(owner, repo, params) {
  return request.get(`/repos/${owner}/${repo}/compare`, { params })
}

// 获取版本列表
export function getRepoTags(owner, repo, params) {
  return request.get(`/versions`, { params: { ...params, repoOwner: owner, repoName: repo } })
}

// 创建版本标签
export function createTag(owner, repo, data) {
  return request.post('/versions', { ...data, repoOwner: owner, repoName: repo })
}
