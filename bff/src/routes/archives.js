/**
 * 归档管理 CRUD（归档/恢复）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取归档列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, archiveType } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('archives');
    
    if (archiveType) {
      query = query.where('archive_type', archiveType);
    }
    
    const total = await query.clone().count('* as count').first();
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

// 恢复归档
router.post('/:id/restore', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await db('archives')
      .where('archive_id', id)
      .update({ status: 'active' });
    
    res.json({ code: 200, message: '恢复成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
