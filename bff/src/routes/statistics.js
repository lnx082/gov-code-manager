import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取仪表盘统计
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const repoCount = await db('approvals').count('* as count').first();
    const pendingApprovals = await db('approvals').where('status', 'pending').count('* as count').first();
    const versionCount = await db('approvals').where('operation_type', 'version').count('* as count').first();
    const baselineCount = await db('baselines').count('* as count').first();
    const userCount = await db('user_profiles').count('* as count').first();
    
    res.json({
      code: 200,
      data: {
        repoCount: parseInt(repoCount.count),
        pendingApprovals: parseInt(pendingApprovals.count),
        versionCount: parseInt(versionCount.count),
        baselineCount: parseInt(baselineCount.count),
        userCount: parseInt(userCount.count),
        onlineUsers: 12, // 模拟数据
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取趋势数据
router.get('/trends', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 生成模拟趋势数据
    const data = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.unshift({
        date: date.toISOString().split('T')[0],
        commits: Math.floor(Math.random() * 50) + 10,
        versions: Math.floor(Math.random() * 5) + 1,
        approvals: Math.floor(Math.random() * 10) + 2,
      });
    }
    
    res.json({ code: 200, data });
  } catch (error) {
    next(error);
  }
});

export default router;
