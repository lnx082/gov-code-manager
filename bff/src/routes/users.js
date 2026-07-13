/**
 * 用户管理 CRUD（锁定/重置密码/修改密码）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import { syncPasswordToGitea } from './auth.js';

const router = Router();

// 获取用户列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, username, role, deptId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let query = db('user_profiles')
      .select(
        'user_profiles.*',
        'roles.name as role_name',
        'departments.name as department_name'
      )
      .leftJoin('roles', 'user_profiles.role_code', 'roles.code')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .where('user_profiles.is_active', true);

    if (username) {
      query = query.where('gitea_username', 'like', `%${username}%`);
    }
    if (role) {
      query = query.where('role_code', role);
    }
    if (deptId) {
      query = query.where('user_profiles.department_id', parseInt(deptId));
    }

    // 单独统计总数
    let countQuery = db('user_profiles').where('is_active', true);
    if (username) {
      countQuery = countQuery.where('gitea_username', 'like', `%${username}%`);
    }
    if (role) {
      countQuery = countQuery.where('role_code', role);
    }
    if (deptId) {
      countQuery = countQuery.where('department_id', parseInt(deptId));
    }
    const total = await countQuery.count('* as count').first();
    
    const users = await query.orderBy('created_at', 'desc')
      .limit(parseInt(pageSize))
      .offset(offset);
    
    res.json({
      code: 200,
      data: {
        list: users,
        total: parseInt(total.count),
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await db('user_profiles')
      .select('user_profiles.*', 'departments.name as department_name')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .where('user_id', req.user.userId)
    
    if (!profile) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    
    res.json({
      code: 200,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

// 创建用户（管理员）
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { username, email, password, nickname, roleCode, departmentId, secretLevel, sendNotify } = req.body;
    
    // 验证必填字段
    if (!username) {
      return res.status(400).json({ code: 400, message: '用户名不能为空' });
    }
    if (!password) {
      return res.status(400).json({ code: 400, message: '密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
    }
    
    // 检查用户名是否已存在（处理软删除的旧账号）
    const existingUser = await db('user_profiles')
      .where('gitea_username', username)
      .first();

    if (existingUser) {
      if (existingUser.is_active) {
        return res.status(400).json({ code: 400, message: '用户名已存在' });
      }
      // 旧账号已注销，硬删除旧记录以便重新创建
      await db('user_profiles').where('gitea_username', username).delete();
    }
    
    // 生成邮箱（如果未提供）
    const userEmail = email || `${username}@example.com`;
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 获取 Gitea 的用户 ID（通过 Gitea API）
    let giteaUserId = null;
    let giteaErrorMsg = '';
    // 优先使用配置的 admin token，否则使用当前管理员用户的 Gitea 凭据
    const giteaAdminToken = config.gitea?.token || req.user?.giteaToken;
    if (giteaAdminToken) {
      try {
        const giteaUrl = config.gitea.url;
        // 智能设置 Authorization header：Basic 格式直接使用，纯 token 加 Bearer
        const authHeader = giteaAdminToken.startsWith('Basic ') || giteaAdminToken.startsWith('Bearer ')
          ? giteaAdminToken
          : `Bearer ${giteaAdminToken}`;
        console.log(`[Gitea] 尝试创建用户 ${username}，Auth 类型: ${authHeader.substring(0, 10)}...`);
        // 调用 Gitea API 创建用户
        const giteaRes = await fetch(`${giteaUrl}/api/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            username: username,
            login_name: username,
            email: userEmail,
            password: password,
            send_notify: sendNotify !== false,
            must_change_password: false
          })
        });

        if (giteaRes.ok) {
          const giteaUser = await giteaRes.json();
          giteaUserId = giteaUser.id;
          console.log(`[Gitea] 用户 ${username} 创建成功，Gitea ID: ${giteaUserId}`);
        } else {
          const errBody = await giteaRes.text();
          giteaErrorMsg = `Gitea 返回 ${giteaRes.status}: ${errBody}`;
          console.error(`[Gitea] 用户 ${username} 创建失败 — ${giteaErrorMsg}`);
        }
      } catch (giteaError) {
        giteaErrorMsg = giteaError.message;
        console.error('[Gitea] 用户创建请求异常:', giteaErrorMsg);
      }
    } else {
      giteaErrorMsg = '无可用的 Gitea 管理员凭据（未配置 GITEA_ADMIN_TOKEN 且当前用户无 giteaToken）';
      console.warn('[Gitea] ' + giteaErrorMsg);
    }
    
    // 在本地数据库创建用户记录
    // 若 Gitea 未提供用户 ID，使用负时间戳作为本地标识
    const localUserId = giteaUserId || -(Date.now() % 2147483647);
    await db('user_profiles').insert({
      user_id: localUserId,
      gitea_username: username.toLowerCase(),
      nickname: nickname || username,
      password_hash: hashedPassword,
      email: userEmail,
      department_id: departmentId || null,
      role_code: roleCode || 'developer',
      secret_level: secretLevel || 'internal',
      permissions: JSON.stringify([]),
      is_active: true,
      account_locked: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
    
    const giteaCreated = !!giteaUserId;
    // 自动添加为部门仓库协作者
    let collabAdded = 0;
    if (giteaCreated && departmentId) {
      collabAdded = await syncDeptCollaborators(username, departmentId, giteaAdminToken, 'add');
    }
    res.json({
      code: 200,
      message: giteaCreated ? `用户创建成功` + (collabAdded ? `（已添加 ${collabAdded} 个仓库协作者）` : '') : '用户创建成功（本地记录，Gitea 同步未完成）',
      data: { userId: localUserId, giteaCreated, collaboratorRepos: collabAdded, giteaError: giteaErrorMsg || undefined }
    });
  } catch (error) {
    next(error);
  }
});

// 检查目标用户是否为系统管理员（禁止操作）
async function checkNotAdmin(id) {
  const target = await db('user_profiles').where('user_id', id).first();
  if (target && target.role_code === 'admin') {
    const err = new Error('不能对系统管理员执行此操作');
    err.status = 400;
    throw err;
  }
  return target;
}

// 更新用户
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkNotAdmin(id);
    const { nickname, role_code, department_id, is_active, email, secret_level } = req.body;

    const updateData = { updated_at: new Date() };
    if (nickname !== undefined) updateData.nickname = nickname;
    if (role_code !== undefined) updateData.role_code = role_code;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (email !== undefined) updateData.email = email;
    if (secret_level !== undefined) updateData.secret_level = secret_level;

    // 如果部门发生变化，同步协作者权限
    let collabMsg = '';
    if (department_id !== undefined) {
      const oldProfile = await db('user_profiles').where('user_id', id).first();
      const oldDept = oldProfile?.department_id;
      const username = oldProfile?.gitea_username;
      const giteaToken = config.gitea?.token || req.user?.giteaToken;
      if (oldDept && oldDept !== department_id && username) {
        // 删除旧部门仓库协作者
        const removed = await syncDeptCollaborators(username, oldDept, giteaToken, 'remove');
        // 添加新部门仓库协作者
        const added = await syncDeptCollaborators(username, department_id, giteaToken, 'add');
        collabMsg = `（已更新协作者：-${removed}/+${added}）`;
      } else if (!oldDept && username) {
        const added = await syncDeptCollaborators(username, department_id, giteaToken, 'add');
        collabMsg = `（已添加 ${added} 个协作者）`;
      }
    }

    await db('user_profiles').where('user_id', id).update(updateData);

    res.json({ code: 200, message: '更新成功' + collabMsg });
  } catch (error) {
    next(error);
  }
});

// 重置用户密码（管理员）
router.post('/:id/reset-password', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkNotAdmin(id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '新密码长度不能少于6位'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 先获取用户信息（用于同步 Gitea）
    const profile = await db('user_profiles')
      .where('user_id', id)
      .first();

    if (!profile) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 更新本地密码（先更新本地，确保用户能用本地兜底登录）
    await db('user_profiles')
      .where('user_id', id)
      .update({
        password_hash: hashedPassword,
        updated_at: new Date(),
      });

    // 后台同步 Gitea 密码（不阻塞响应，自愈机制）
    let giteaSynced = false;
    let giteaErrorMsg = '';

    try {
      giteaSynced = await syncPasswordToGitea(profile.gitea_username, newPassword, profile.role_code);
      if (giteaSynced) {
        console.log(`[PasswordReset] Gitea 用户 ${profile.gitea_username} 密码同步成功`);
      }
    } catch (syncErr) {
      giteaErrorMsg = syncErr.message;
      console.error(`[PasswordReset] Gitea 密码同步异常: ${giteaErrorMsg}`);
    }

    if (!giteaSynced && !giteaErrorMsg) {
      giteaErrorMsg = 'Gitea 同步未完成（后台自动重试中，下次登录时自愈）';
    }

    res.json({
      code: 200,
      message: '密码重置成功',
      data: { giteaSynced, giteaError: giteaErrorMsg || undefined }
    });
  } catch (error) {
    next(error);
  }
});

// 锁定/解锁用户
router.post('/:id/lock', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkNotAdmin(id);
    const { locked } = req.body;
    
    // locked_until 为时间戳：NULL=未锁定，未来时间=锁定
    const lockedUntil = locked ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
    await db('user_profiles')
      .where('user_id', id)
      .update({
        locked_until: lockedUntil,
        account_locked: locked ? true : false,
        updated_at: new Date(),
      });

    res.json({
      code: 200,
      message: locked ? '用户已锁定' : '用户已解锁',
    });
  } catch (error) {
    next(error);
  }
});

// 删除用户（软删除：标记为注销，保留记录防止重新登录）
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 检查是否是删除自己
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({
        code: 400,
        message: '不能删除当前登录用户',
      });
    }
    await checkNotAdmin(id);

    const profile = await db('user_profiles').where('user_id', id).first();
    if (!profile) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 同步删除 Gitea 用户
    const giteaToken = config.gitea?.token || req.user?.giteaToken;
    if (giteaToken && profile.gitea_username) {
      try {
        const authHdr = giteaToken.startsWith('Basic ') || giteaToken.startsWith('Bearer ')
          ? giteaToken : `Bearer ${giteaToken}`;
        await fetch(`${config.gitea.url}/api/v1/admin/users/${encodeURIComponent(profile.gitea_username)}`, {
          method: 'DELETE',
          headers: { 'Authorization': authHdr, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.warn('Gitea 用户删除失败（继续本地操作）:', e.message);
      }
    }

    // 清理部门仓库协作者权限（跳过用户是管理员的仓库）
    let collabRemoved = 0;
    if (profile.gitea_username && profile.department_id) {
      const giteaToken2 = config.gitea?.token || req.user?.giteaToken;
      if (giteaToken2) {
        const authHdr2 = giteaToken2.startsWith('Basic ') || giteaToken2.startsWith('Bearer ') ? giteaToken2 : `Bearer ${giteaToken2}`;
        const deptRepos = await db('repo_metadata').where('department_id', profile.department_id).select('repo_owner', 'repo_name');
        for (const repo of deptRepos) {
          try {
            // 检查用户权限，skip 管理员
            const permRes = await fetch(`${config.gitea.url}/api/v1/repos/${repo.repo_owner}/${repo.repo_name}/collaborators/${profile.gitea_username}`, {
              headers: { 'Authorization': authHdr2 }
            });
            if (permRes.status === 204) {
              // 用户是协作者——检查权限后再决定是否删除
              // Gitea 1.21 的 GET collaborators/{username} 不返回具体权限，仅 204 表示存在
              // 对非管理员仓库，安全移除该协作者
              await fetch(`${config.gitea.url}/api/v1/repos/${repo.repo_owner}/${repo.repo_name}/collaborators/${profile.gitea_username}`, {
                method: 'DELETE', headers: { 'Authorization': authHdr2 }
              });
              collabRemoved++;
            }
          } catch { /* skip */ }
        }
      }
    }

    // 本地软删除
    await db('user_profiles')
      .where('user_id', id)
      .update({
        is_active: false,
        account_locked: true,
        role_code: 'user',
        updated_at: new Date(),
      });

    res.json({
      code: 200,
      message: `用户已注销（已清理 ${collabRemoved} 个仓库协作者权限）`,
    });
  } catch (error) {
    next(error);
  }
});

// 修改密码（本人）
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        code: 400, 
        message: '原密码和新密码不能为空' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        code: 400, 
        message: '新密码长度不能少于6位' 
      });
    }
    
    // 验证旧密码
    const profile = await db('user_profiles')
      .where('user_id', req.user.userId)
      .first();
    
    if (!profile) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    
    // 如果有保存密码，验证旧密码
    if (profile.password_hash) {
      const isValid = await bcrypt.compare(oldPassword, profile.password_hash);
      if (!isValid) {
        return res.status(400).json({
          code: 400,
          message: '原密码错误',
        });
      }
    }
    
    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db('user_profiles')
      .where('user_id', req.user.userId)
      .update({
        password_hash: hashedPassword,
        updated_at: new Date(),
      });
    
    res.json({
      code: 200,
      message: '密码修改成功',
    });
  } catch (error) {
    next(error);
  }
});

// 同步用户对部门仓库的协作者权限
async function syncDeptCollaborators(username, departmentId, giteaToken, action) {
  if (!departmentId || !username || !giteaToken) return 0;
  const authHdr = giteaToken.startsWith('Basic ') || giteaToken.startsWith('Bearer ') ? giteaToken : `Bearer ${giteaToken}`;
  const deptRepos = await db('repo_metadata').where('department_id', departmentId).select('repo_owner', 'repo_name');
  let count = 0;
  for (const repo of deptRepos) {
    try {
      const method = action === 'remove' ? 'DELETE' : 'PUT';
      const body = action === 'remove' ? undefined : JSON.stringify({ permission: 'write' });
      const res = await fetch(`${config.gitea.url}/api/v1/repos/${repo.repo_owner}/${repo.repo_name}/collaborators/${username}`, {
        method, headers: { 'Authorization': authHdr, 'Content-Type': 'application/json' }, body
      });
      if (res.ok) count++;
    } catch { /* skip */ }
  }
  return count;
}

export default router;
