/**
 * 用户认证 API 封装（登录/登出/用户信息）
 */
import request from './index'

// 用户登录
export function login(username, password) {
  return request.post('/auth/login', { username, password })
}

// 获取当前用户信息
export function getUserInfo() {
  return request.get('/auth/me')
}

// 用户登出
export function logout() {
  return request.post('/auth/logout')
}

// 获取用户列表
export function getUserList(params) {
  return request.get('/users', { params })
}

// 获取单个用户
export function getUserDetail(id) {
  return request.get(`/users/${id}`)
}

// 更新用户
export function updateUser(id, data) {
  return request.put(`/users/${id}`, data)
}

// 删除用户
export function deleteUser(id) {
  return request.delete(`/users/${id}`)
}

// 锁定/解锁用户
export function lockUser(id, locked) {
  return request.post(`/users/${id}/lock`, { locked })
}

// 修改密码
export function changePassword(data) {
  return request.post('/users/change-password', data)
}

// 获取会话列表
export function getMySessions() {
  return request.get('/sessions/my')
}

// 删除会话
export function deleteSession(sessionId) {
  return request.delete(`/sessions/${sessionId}`)
}

// 清除其他会话
export function clearOtherSessions() {
  return request.delete('/sessions/others/clear')
}
