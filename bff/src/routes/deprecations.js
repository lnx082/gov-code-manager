import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取废弃版本列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const total = await db('version_deprecations').count('* as count').first();
    const list = await db('version_deprecations')
      .orderBy('created_at', 'desc')
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

// 废弃版本
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { repoOwner, repoName, tagName, reason, deprecationType } = req.body;
    
    await db('version_deprecations').insert({
      repo_owner: repoOwner,
      repo_name: repoName,
      tag_name: tagName,
      reason: reason || '',
      deprecation_type: deprecationType || 'archive',
      status: 'deprecated',
      deprecated_by: req.user.userId,
      created_at: new Date(),
    });

    res.json({ code: 200, message: '版本已废弃' });
  } catch (error) {
    next(error);
  }
});

export default router;
