/**
 * 部门管理 CRUD（树形结构）
 *
 * 【功能】部门列表（支持树形结构）、创建/编辑/删除部门
 *        删除前检查是否还有活跃子部门或用户，防止误删
 * 【数据】查询/写入：departments（部门信息）
 *        查询：user_profiles（检查是否有活跃用户）
 * 【来源】openGauss（通过 db()）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取部门列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { tree } = req.query;
    
    if (tree === 'true') {
      // 返回树形结构
      const depts = await db('departments').orderBy('sort_order', 'asc');
      const treeData = buildTree(depts);
      res.json({ code: 200, data: treeData });
    } else {
      const depts = await db('departments').orderBy('sort_order', 'asc');
      res.json({ code: 200, data: depts });
    }
  } catch (error) {
    next(error);
  }
});

// 获取部门详情
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const dept = await db('departments').where('dept_id', id).first();
    
    if (!dept) {
      return res.status(404).json({ code: 404, message: '部门不存在' });
    }
    
    res.json({ code: 200, data: dept });
  } catch (error) {
    next(error);
  }
});

// 创建部门
router.post('/', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { name, code, parentId, leader, description } = req.body;
    
    await db('departments').insert({
      name,
      code,
      parent_id: parentId || null,
      leader: leader || '',
      description: description || '',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    res.json({ code: 200, message: '部门创建成功' });
  } catch (error) {
    next(error);
  }
});

// 更新部门
router.put('/:id', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, leader, description, is_active } = req.body;
    
    await db('departments')
      .where('dept_id', id)
      .update({
        name,
        leader,
        description,
        is_active: is_active !== false,
        updated_at: new Date(),
      });
    
    res.json({ code: 200, message: '部门更新成功' });
  } catch (error) {
    next(error);
  }
});

// 删除部门
router.delete('/:id', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 检查部门是否存在
    const dept = await db('departments').where('dept_id', id).first();
    if (!dept) {
      return res.status(404).json({ code: 404, message: '部门不存在' });
    }

    // 检查是否有子部门
    const childCount = await db('departments').where('parent_id', id).where('is_active', true).count('* as count').first();
    if (parseInt(childCount.count) > 0) {
      return res.status(400).json({ code: 400, message: '该部门下有子部门，请先删除子部门' });
    }

    // 检查是否有活跃用户（"目前的系统用户"）
    const activeUserCount = await db('user_profiles')
      .where('department_id', id)
      .where('is_active', true)
      .count('* as count')
      .first();
    if (parseInt(activeUserCount.count) > 0) {
      return res.status(400).json({
        code: 400,
        message: `该部门下还有 ${activeUserCount.count} 名活跃用户，无法删除。请先将用户移出部门后再试`,
        data: { activeUserCount: parseInt(activeUserCount.count) }
      });
    }

    await db('departments').where('dept_id', id).delete();

    res.json({ code: 200, message: '部门删除成功' });
  } catch (error) {
    next(error);
  }
});

// 构建树形结构
function buildTree(depts) {
  const map = {};
  const roots = [];
  
  depts.forEach(dept => {
    map[dept.dept_id] = { ...dept, children: [] };
  });
  
  depts.forEach(dept => {
    if (dept.parent_id && map[dept.parent_id]) {
      map[dept.parent_id].children.push(map[dept.dept_id]);
    } else {
      roots.push(map[dept.dept_id]);
    }
  });
  
  return roots;
}

export default router;
