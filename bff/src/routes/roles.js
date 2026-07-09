import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取角色列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const roles = await db('roles').orderBy('sort_order', 'asc');
    res.json({ code: 200, data: roles });
  } catch (error) {
    next(error);
  }
});

// 获取角色详情
router.get('/:code', authenticate, async (req, res, next) => {
  try {
    const { code } = req.params;
    const role = await db('roles').where('role_code', code).first();
    
    if (!role) {
      return res.status(404).json({ code: 404, message: '角色不存在' });
    }
    
    res.json({ code: 200, data: role });
  } catch (error) {
    next(error);
  }
});

// 创建角色
router.post('/', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { roleCode, roleName, description, permissions } = req.body;
    
    const [roleId] = await db('roles').insert({
      role_code: roleCode,
      role_name: roleName,
      description: description || '',
      permissions: JSON.stringify(permissions || []),
      is_system: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    
    res.json({ code: 200, message: '角色创建成功', data: { roleId } });
  } catch (error) {
    next(error);
  }
});

// 更新角色
router.put('/:code', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { code } = req.params;
    const { roleName, description, permissions, is_active } = req.body;
    
    await db('roles')
      .where('role_code', code)
      .update({
        role_name: roleName,
        description: description,
        permissions: JSON.stringify(permissions || []),
        is_active: is_active !== false,
        updated_at: new Date(),
      });
    
    res.json({ code: 200, message: '角色更新成功' });
  } catch (error) {
    next(error);
  }
});

// 删除角色
router.delete('/:code', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // 检查是否为系统角色
    const role = await db('roles').where('role_code', code).first();
    if (role?.is_system) {
      return res.status(400).json({ code: 400, message: '系统角色不能删除' });
    }
    
    // 检查是否有用户使用该角色
    const userCount = await db('user_profiles').where('role_code', code).count('* as count').first();
    if (parseInt(userCount.count) > 0) {
      return res.status(400).json({ code: 400, message: '该角色下有用户，无法删除' });
    }
    
    await db('roles').where('role_code', code).delete();
    
    res.json({ code: 200, message: '角色删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
