import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 获取备份列表
router.get('/', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const total = await db('backups').count('* as count').first();
    const list = await db('backups')
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

// 创建备份
router.post('/', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { name, type = 'manual', scope = 'full' } = req.body;
    
    const [backupId] = await db('backups').insert({
      name,
      type,
      scope,
      status: 'running',
      progress: 0,
      created_by: req.user.username,
      start_time: new Date(),
    });
    
    // 模拟备份过程
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 25;
      if (progress >= 100) {
        clearInterval(interval);
        await db('backups')
          .where('backup_id', backupId)
          .update({
            status: 'completed',
            progress: 100,
            file_size: 1024 * 1024 * 50, // 50MB
            end_time: new Date(),
          });
      } else {
        await db('backups')
          .where('backup_id', backupId)
          .update({ progress });
      }
    }, 1000);
    
    res.json({ code: 200, message: '备份开始', data: { backupId } });
  } catch (error) {
    next(error);
  }
});

// 恢复备份
router.post('/:id/restore', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await db('backups')
      .where('backup_id', id)
      .update({ status: 'restoring' });
    
    res.json({ code: 200, message: '恢复开始，请稍候...' });
  } catch (error) {
    next(error);
  }
});

// 删除备份
router.delete('/:id', authenticate, requirePermission('admin:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await db('backups').where('backup_id', id).delete();
    res.json({ code: 200, message: '备份已删除' });
  } catch (error) {
    next(error);
  }
});

export default router;
