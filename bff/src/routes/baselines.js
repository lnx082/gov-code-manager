import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取基线列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('baselines');
    
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

// 获取基线详情
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const baseline = await db('baselines').where('baseline_id', id).first();
    
    if (!baseline) {
      return res.status(404).json({ code: 404, message: '基线不存在' });
    }
    
    res.json({
      code: 200,
      data: baseline,
    });
  } catch (error) {
    next(error);
  }
});

// 创建基线
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, version, repoOwner, repoName, tagName, description } = req.body;
    
    const [baselineId] = await db('baselines').insert({
      name,
      version,
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
      message: '基线创建成功',
      data: { baselineId },
    });
  } catch (error) {
    next(error);
  }
});

// 锁定/解锁基线
router.post('/:id/lock', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { locked } = req.body;
    
    await db('baselines')
      .where('baseline_id', id)
      .update({
        lock_status: locked ? 'locked' : 'unlocked',
        updated_at: new Date(),
      });
    
    res.json({
      code: 200,
      message: locked ? '基线已锁定' : '基线已解锁',
    });
  } catch (error) {
    next(error);
  }
});

// 冻结基线
router.post('/:id/freeze', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await db('baselines')
      .where('baseline_id', id)
      .update({
        status: 'frozen',
        updated_at: new Date(),
      });
    
    res.json({
      code: 200,
      message: '基线已冻结',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
