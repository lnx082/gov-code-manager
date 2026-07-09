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
    
    const [deptId] = await db('departments').insert({
      name,
      code,
      parent_id: parentId || null,
      leader: leader || '',
      description: description || '',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    
    res.json({ code: 200, message: '部门创建成功', data: { deptId } });
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
    
    // 检查是否有子部门
    const childCount = await db('departments').where('parent_id', id).count('* as count').first();
    if (parseInt(childCount.count) > 0) {
      return res.status(400).json({ code: 400, message: '该部门下有子部门，无法删除' });
    }
    
    // 检查是否有用户
    const userCount = await db('user_profiles').where('department_id', id).count('* as count').first();
    if (parseInt(userCount.count) > 0) {
      return res.status(400).json({ code: 400, message: '该部门下有用户，无法删除' });
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
