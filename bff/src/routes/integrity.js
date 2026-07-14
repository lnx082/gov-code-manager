/**
 * 完整性校验
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 验证日志完整性
router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const { startId, endId } = req.body;
    
    const logs = await db('audit_logs')
      .whereBetween('log_id', [startId, endId])
      .orderBy('timestamp', 'asc');
    
    let isValid = true;
    const invalidLogs = [];
    let prevHash = null;
    
    for (const log of logs) {
      if (prevHash && log.prev_hash !== prevHash) {
        isValid = false;
        invalidLogs.push(log.log_id);
      }
      prevHash = log.integrity_hash;
    }
    
    res.json({
      code: 200,
      data: {
        isValid,
        totalLogs: logs.length,
        invalidLogs,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
