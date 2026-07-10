/**
 * 角色管理 CRUD + 权限定义列表
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 获取角色列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const roles = await db('roles').orderBy('sort_order', 'asc').orderBy('role_id', 'asc');
    res.json({ code: 200, data: roles });
  } catch (error) {
    next(error);
  }
});

// 获取角色详情
router.get('/:roleId', authenticate, async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const role = await db('roles').where('role_id', roleId).first();

    if (!role) {
      return res.status(404).json({ code: 404, message: '角色不存在' });
    }

    res.json({ code: 200, data: role });
  } catch (error) {
    next(error);
  }
});

// 创建角色
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { roleCode, roleName, description, permissions, sortOrder } = req.body;

    // 验证必填字段
    if (!roleCode) {
      return res.status(400).json({ code: 400, message: '角色代码不能为空' });
    }
    if (!roleName) {
      return res.status(400).json({ code: 400, message: '角色名称不能为空' });
    }

    // 检查角色代码是否已存在
    const existing = await db('roles').where('code', roleCode).first();
    if (existing) {
      return res.status(400).json({ code: 400, message: '角色代码已存在' });
    }

    await db('roles').insert({
      code: roleCode,
      name: roleName,
      description: description || '',
      permissions: JSON.stringify(permissions || []),
      is_system: false,
      sort_order: sortOrder || 99,
      created_at: new Date(),
      updated_at: new Date(),
    });

    res.json({ code: 200, message: '角色创建成功' });
  } catch (error) {
    next(error);
  }
});

// 更新角色
router.put('/:roleId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { roleName, description, permissions, sortOrder } = req.body;

    // 检查角色是否存在
    const role = await db('roles').where('role_id', roleId).first();
    if (!role) {
      return res.status(404).json({ code: 404, message: '角色不存在' });
    }

    const updateData = { updated_at: new Date() };
    if (roleName !== undefined) updateData.name = roleName;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;

    await db('roles')
      .where('role_id', roleId)
      .update(updateData);

    res.json({ code: 200, message: '角色更新成功' });
  } catch (error) {
    next(error);
  }
});

// 删除角色
router.delete('/:roleId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { roleId } = req.params;

    // 检查是否为系统角色
    const role = await db('roles').where('role_id', roleId).first();
    if (!role) {
      return res.status(404).json({ code: 404, message: '角色不存在' });
    }
    if (role.is_system) {
      return res.status(400).json({ code: 400, message: '系统角色不能删除' });
    }

    // 检查是否有用户使用该角色
    const userCount = await db('user_profiles').where('role_code', role.code).count('* as count').first();
    if (parseInt(userCount.count) > 0) {
      return res.status(400).json({ code: 400, message: '该角色下有用户，无法删除' });
    }

    await db('roles').where('role_id', roleId).delete();

    res.json({ code: 200, message: '角色删除成功' });
  } catch (error) {
    next(error);
  }
});

// 获取所有权限列表
router.get('/permissions/all', authenticate, async (req, res, next) => {
  try {
    const permissions = [
      // 仓库权限
      { code: 'repo:view', name: '查看仓库', category: '仓库管理' },
      { code: 'repo:create', name: '创建仓库', category: '仓库管理' },
      { code: 'repo:edit', name: '编辑仓库', category: '仓库管理' },
      { code: 'repo:delete', name: '删除仓库', category: '仓库管理' },
      { code: 'repo:manage', name: '仓库管理权限', category: '仓库管理' },
      
      // 分支权限
      { code: 'branch:view', name: '查看分支', category: '分支管理' },
      { code: 'branch:create', name: '创建分支', category: '分支管理' },
      { code: 'branch:edit', name: '编辑分支', category: '分支管理' },
      { code: 'branch:delete', name: '删除分支', category: '分支管理' },
      { code: 'branch:merge', name: '合并分支', category: '分支管理' },
      
      // 版本权限
      { code: 'version:view', name: '查看版本', category: '版本管理' },
      { code: 'version:create', name: '创建版本', category: '版本管理' },
      { code: 'version:publish', name: '发布版本', category: '版本管理' },
      { code: 'version:delete', name: '删除版本', category: '版本管理' },
      
      // 审批权限
      { code: 'approval:view', name: '查看审批', category: '审批管理' },
      { code: 'approval:create', name: '创建审批', category: '审批管理' },
      { code: 'approval:approve', name: '审批通过', category: '审批管理' },
      { code: 'approval:reject', name: '审批拒绝', category: '审批管理' },
      
      // 基线权限
      { code: 'baseline:view', name: '查看基线', category: '基线管理' },
      { code: 'baseline:create', name: '创建基线', category: '基线管理' },
      { code: 'baseline:lock', name: '锁定基线', category: '基线管理' },
      
      // 审计权限
      { code: 'audit:view', name: '查看审计日志', category: '审计管理' },
      { code: 'audit:export', name: '导出审计报表', category: '审计管理' },
      
      // 系统管理权限
      { code: 'admin:manage', name: '系统管理', category: '系统管理' },
      { code: 'admin:user', name: '用户管理', category: '系统管理' },
      { code: 'admin:role', name: '角色管理', category: '系统管理' },
      { code: 'admin:dept', name: '部门管理', category: '系统管理' },
      { code: 'admin:backup', name: '备份管理', category: '系统管理' },
    ];
    
    res.json({ code: 200, data: permissions });
  } catch (error) {
    next(error);
  }
});

// 获取角色默认权限
router.get('/default-permissions/:roleCode', authenticate, async (req, res, next) => {
  try {
    const { roleCode } = req.params;
    const role = await db('roles').where('code', roleCode).first();
    
    if (!role) {
      return res.status(404).json({ code: 404, message: '角色不存在' });
    }
    
    const permissions = role.permissions ? JSON.parse(role.permissions) : [];
    res.json({ code: 200, data: permissions });
  } catch (error) {
    next(error);
  }
});

export default router;
