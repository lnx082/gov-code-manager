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

// 恢复归档 — 同时解冻 Gitea 仓库（取消 archived 状态）
router.post('/:id/restore', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const archive = await db('archives').where('archive_id', id).first();
    if (!archive) {
      return res.status(404).json({ code: 404, message: '归档记录不存在' });
    }

    // 解冻 Gitea 仓库（archived: false），使其恢复读写
    if (archive.repo_owner && archive.repo_name) {
      try {
        const { default: config } = await import('../config/index.js');
        const adminToken = config.gitea?.token || req.user?.giteaToken || '';
        const authHeader = adminToken.startsWith('Basic ') ? adminToken : (adminToken ? `Bearer ${adminToken}` : '');
        if (authHeader) {
          const giteaRes = await fetch(`${config.gitea.url}/api/v1/repos/${archive.repo_owner}/${archive.repo_name}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ archived: false }),
          });
          if (giteaRes.ok) {
            console.log(`[Archive] Gitea 仓库 ${archive.repo_owner}/${archive.repo_name} 已解除归档`);
          } else {
            const errBody = await giteaRes.text();
            console.warn(`[Archive] Gitea 解冻失败: ${giteaRes.status} ${errBody}`);
          }
        }
      } catch (giteaErr) {
        console.warn('[Archive] Gitea API 调用异常:', giteaErr.message);
      }
    }

    // 删除归档记录
    await db('archives').where('archive_id', id).delete();

    res.json({ code: 200, message: '归档已恢复，仓库已解除只读状态' });
  } catch (error) {
    next(error);
  }
});

export default router;
