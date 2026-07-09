import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取用户列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, username, role } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('user_profiles')
      .select('user_profiles.*', 'roles.role_name', 'departments.name as department_name')
      .leftJoin('roles', 'user_profiles.role_code', 'roles.role_code')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id');
    
    if (username) {
      query = query.where('gitea_username', 'like', `%${username}%`);
    }
    if (role) {
      query = query.where('role_code', role);
    }
    
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();
    
    const users = await query.orderBy('user_profiles.created_at', 'desc')
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
      .where('profile_id', req.user.userId)
      .first();
    
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

// 更新用户
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nickname, role_code, department_id, secret_level, is_active } = req.body;
    
    await db('user_profiles')
      .where('profile_id', id)
      .update({
        nickname,
        role_code,
        department_id,
        secret_level,
        is_active,
        updated_at: new Date(),
      });
    
    res.json({
      code: 200,
      message: '更新成功',
    });
  } catch (error) {
    next(error);
  }
});

// 锁定/解锁用户
router.post('/:id/lock', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { locked } = req.body;
    
    await db('user_profiles')
      .where('profile_id', id)
      .update({
        account_locked: locked,
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

// 删除用户
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await db('user_profiles').where('profile_id', id).delete();
    
    res.json({
      code: 200,
      message: '删除成功',
    });
  } catch (error) {
    next(error);
  }
});

// 修改密码
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    // 验证旧密码
    const profile = await db('user_profiles')
      .where('profile_id', req.user.userId)
      .first();
    
    if (profile.password_hash) {
      const bcrypt = await import('bcryptjs');
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
      .where('profile_id', req.user.userId)
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
