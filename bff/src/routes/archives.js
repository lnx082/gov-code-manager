/**
 * 归档管理 CRUD（归档/恢复）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';
import { getRepoVisibilityFilter } from './repoMeta.js';

const router = Router();

// 获取归档列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, archiveType } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    // 部门密级过滤
    const filter = await getRepoVisibilityFilter(req.user);
    let query = db('archives');
    if (archiveType) query = query.where('archive_type', archiveType);
    if (filter) {
      query = query
        .leftJoin('repo_metadata', function () {
          this.on('archives.repo_owner', 'repo_metadata.repo_owner')
            .andOn('archives.repo_name', 'repo_metadata.repo_name');
        })
        .where(function () {
          this.where('repo_metadata.department_id', filter.department_id)
            .whereIn('repo_metadata.secret_level', filter.allowed_secret_levels);
        }).orWhereNull('repo_metadata.department_id')
        .select('archives.*');
    }

    let countQuery = db('archives');
    if (archiveType) countQuery = countQuery.where('archive_type', archiveType);
    if (filter) {
      countQuery = countQuery
        .leftJoin('repo_metadata', function () {
          this.on('archives.repo_owner', 'repo_metadata.repo_owner')
            .andOn('archives.repo_name', 'repo_metadata.repo_name');
        })
        .where(function () {
          this.where('repo_metadata.department_id', filter.department_id)
            .whereIn('repo_metadata.secret_level', filter.allowed_secret_levels);
        }).orWhereNull('repo_metadata.department_id');
    }
    const total = await countQuery.count('* as count').first();
    const list = await query.orderBy('created_at', 'desc')
      .limit(parseInt(pageSize))
      .offset(offset);
    
    res.json({
      code: 200,
      data: {
        list,
        total: parseInt(total.count),
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 创建归档
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { repoOwner, repoName, tagName, archiveType, reason } = req.body;
    
    await db('archives').insert({
      repo_owner: repoOwner,
      repo_name: repoName,
      tag_name: tagName,
      archive_type: archiveType || 'archive',
      archive_reason: reason || '',
      status: 'archived',
      archived_by: req.user.userId,
      created_at: new Date(),
    });

    res.json({ code: 200, message: '归档成功' });
  } catch (error) {
    next(error);
  }
});

// 恢复归档（已禁用：一旦归档不能恢复）
router.post('/:id/restore', authenticate, async (req, res) => {
  return res.status(403).json({ code: 403, message: '归档后不能恢复，如需重新启用请创建新基线' });
});

export default router;
