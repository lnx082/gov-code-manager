/**
 * 仓库元数据管理（部门→密级映射 + 中文显示名）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 密级层级
const SECURITY_HIERARCHY = { 'public': 1, 'internal': 2, 'secret': 3, 'confidential': 4, 'top-secret': 5 };

// 获取当前用户的部门过滤和密级过滤条件
export async function getRepoVisibilityFilter(user) {
  if (!user) return null;
  if (user.roleCode === 'admin') return null; // 管理员看全部

  const profile = await db('user_profiles').where('user_id', user.userId).first();
  if (!profile) return null;

  const deptId = profile.department_id || null;
  const userLevel = SECURITY_HIERARCHY[profile.secret_level] || 1;
  const allowedLevels = Object.entries(SECURITY_HIERARCHY)
    .filter(([, v]) => v <= userLevel)
    .map(([k]) => k);

  return {
    department_id: deptId,
    allowed_secret_levels: allowedLevels
  };
}

// 对仓库列表应用部门密级过滤（基于 repo_metadata 表）
export function applyRepoFilter(query, filter) {
  if (!filter) return query;
  // 通过子查询获取符合部门密级的仓库
  query = query.whereRaw(
    `(repo_owner, repo_name) IN (SELECT repo_owner, repo_name FROM repo_metadata WHERE department_id = ? AND secret_level = ANY(?))`,
    [filter.department_id, filter.allowed_secret_levels]
  );
  return query;
}

// 获取/设置仓库元数据
router.put('/:owner/:name', authenticate, async (req, res, next) => {
  try {
    const { owner, name } = req.params;
    const { department_id, secret_level, display_name } = req.body;

    const exists = await db('repo_metadata').where({ repo_owner: owner, repo_name: name }).first();
    if (exists) {
      await db('repo_metadata').where({ repo_owner: owner, repo_name: name }).update({
        department_id: department_id || exists.department_id,
        secret_level: secret_level || exists.secret_level,
        display_name: display_name || exists.display_name,
        updated_at: new Date()
      });
    } else {
      await db('repo_metadata').insert({
        repo_owner: owner,
        repo_name: name,
        department_id: department_id || null,
        secret_level: secret_level || 'internal',
        display_name: display_name || `${owner}/${name}`,
      });
    }

    res.json({ code: 200, message: '元数据更新成功' });
  } catch (error) {
    next(error);
  }
});

// 获取所有仓库元数据（用于前端筛选中显示中文名）
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await db('repo_metadata').select('*');
    res.json({ code: 200, data: list });
  } catch (error) {
    next(error);
  }
});

export default router;
