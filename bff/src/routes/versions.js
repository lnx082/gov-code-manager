import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取版本列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, repoOwner, repoName, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('approvals')
      .where('operation_type', 'version');
    
    if (repoOwner) {
      query = query.where('repo_owner', repoOwner);
    }
    if (repoName) {
      query = query.where('repo_name', repoName);
    }
    if (status) {
      query = query.where('status', status);
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

// 获取版本详情
router.get('/:tagName', authenticate, async (req, res, next) => {
  try {
    const { tagName } = req.params;
    const { repoOwner, repoName } = req.query;
    
    let query = db('approvals')
      .where('operation_type', 'version')
      .whereRaw(`title LIKE ?`, [`%${decodeURIComponent(tagName)}%`]);
    
    if (repoOwner) {
      query = query.where('repo_owner', repoOwner);
    }
    if (repoName) {
      query = query.where('repo_name', repoName);
    }
    
    const version = await query.first();
    
    if (!version) {
      return res.status(404).json({ code: 404, message: '版本不存在' });
    }
    
    res.json({
      code: 200,
      data: version,
    });
  } catch (error) {
    next(error);
  }
});

// 创建版本（创建标签）
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { repoOwner, repoName, tagName, message, targetBranch } = req.body;
    
    // 创建审批申请
    await db('approvals').insert({
      operation_type: 'version',
      title: `创建版本 ${tagName}`,
      description: message || '',
      repo_owner: repoOwner,
      repo_name: repoName,
      target_branch: targetBranch,
      status: 'pending',
      urgency: 'normal',
      secret_level: 'internal',
      applicant_user_id: req.user.userId,
      applicant_username: req.user.username,
      created_at: new Date(),
      updated_at: new Date(),
    });

    res.json({
      code: 200,
      message: '版本创建申请已提交，等待审批',
    });
  } catch (error) {
    next(error);
  }
});

// 标记为基线
router.post('/:tagName/baseline', authenticate, async (req, res, next) => {
  try {
    const { tagName } = req.params;
    const { repoOwner, repoName, description } = req.body;
    
    // 创建基线记录
    await db('baselines').insert({
      name: `Baseline-${tagName}`,
      version: tagName,
      repo_owner: repoOwner,
      repo_name: repoName,
      tag_name: tagName,
      description: description || '',
      status: 'active',
      lock_status: 'locked',
      created_by: req.user.userId,
      created_username: req.user.username,
      created_at: new Date(),
      updated_at: new Date(),
      locked_at: new Date(),
    });

    res.json({
      code: 200,
      message: '已标记为基线版本',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
