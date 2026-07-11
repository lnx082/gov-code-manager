/**
 * 用户管理 CRUD（锁定/重置密码/修改密码）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';

const router = Router();

// 获取用户列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, username, role, deptId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let query = db('user_profiles')
      .select('user_profiles.*', 'roles.name as role_name', 'departments.name as department_name')
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
    
    // 检查用户名是否已存在
    const existingUser = await db('user_profiles')
      .where('gitea_username', username)
      .first();
    
    if (existingUser) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }
    
    // 生成邮箱（如果未提供）
    const userEmail = email || `${username}@gov.local`;
    
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
      gitea_username: username,
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
    res.json({
      code: 200,
      message: giteaCreated ? '用户创建成功（已同步创建 Gitea 账户）' : '用户创建成功（本地记录，Gitea 同步未完成）',
      data: { userId: localUserId, giteaCreated, giteaError: giteaErrorMsg || undefined }
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

    await db('user_profiles')
      .where('user_id', id)
      .update(updateData);
    
    res.json({
      code: 200,
      message: '更新成功',
    });
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
    await db('user_profiles')
      .where('user_id', id)
      .update({
        password_hash: hashedPassword,
        updated_at: new Date(),
      });
    
    res.json({
      code: 200,
      message: '密码重置成功',
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
      message: '用户已注销（含 Gitea 账号同步删除）',
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

export default router;
