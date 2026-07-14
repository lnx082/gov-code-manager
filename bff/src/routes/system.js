/**
 * 系统配置管理
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 获取系统配置
router.get('/config', authenticate, async (req, res, next) => {
  try {
    const configs = await db('system_config').select('config_key', 'config_value', 'description');
    
    const configMap = {};
    configs.forEach(c => {
      configMap[c.config_key] = c.config_value;
    });
    
    res.json({ code: 200, data: configMap });
  } catch (error) {
    next(error);
  }
});

// 更新系统配置
router.put('/config', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { configs } = req.body;
    
    for (const [key, value] of Object.entries(configs)) {
      const existing = await db('system_config').where('config_key', key).first();
      
      if (existing) {
        await db('system_config')
          .where('config_key', key)
          .update({
            config_value: value,
            updated_at: new Date(),
          });
      } else {
        await db('system_config').insert({
          config_key: key,
          config_value: value,
          updated_at: new Date(),
        });
      }
    }
    
    res.json({ code: 200, message: '配置更新成功' });
  } catch (error) {
    next(error);
  }
});

// 获取系统状态
router.get('/status', authenticate, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      data: {
        version: '1.0.0',
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        status: 'running',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
