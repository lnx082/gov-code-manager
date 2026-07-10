/**
 * 版本编号规则管理
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取版本规则
router.get('/', authenticate, async (req, res, next) => {
  try {
    const rules = await db('version_rules').first();
    res.json({ code: 200, data: rules });
  } catch (error) {
    next(error);
  }
});

// 更新版本规则
router.put('/', authenticate, async (req, res, next) => {
  try {
    const { defaultPattern, patterns, autoIncrementRules, prohibitPatterns } = req.body;
    
    const existing = await db('version_rules').first();
    
    if (existing) {
      await db('version_rules')
        .where('id', existing.id)
        .update({
          default_pattern: defaultPattern,
          patterns: JSON.stringify(patterns || []),
          auto_increment_rules: JSON.stringify(autoIncrementRules || {}),
          prohibit_patterns: JSON.stringify(prohibitPatterns || []),
          updated_at: new Date(),
        });
    } else {
      await db('version_rules').insert({
        default_pattern: defaultPattern || 'MAJOR.MINOR.PATCH',
        patterns: JSON.stringify(patterns || []),
        auto_increment_rules: JSON.stringify(autoIncrementRules || {}),
        prohibit_patterns: JSON.stringify(prohibitPatterns || []),
        updated_at: new Date(),
      });
    }
    
    res.json({ code: 200, message: '规则更新成功' });
  } catch (error) {
    next(error);
  }
});

// 验证版本号
router.post('/validate', authenticate, async (req, res, next) => {
  try {
    const { version } = req.body;
    
    // 简单的语义化版本验证
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
    const isValid = semverRegex.test(version);
    
    // 检查是否禁止的模式
    const rules = await db('version_rules').first();
    let prohibited = false;
    let reason = '';
    
    if (rules?.prohibit_patterns) {
      const patterns = JSON.parse(rules.prohibit_patterns);
      for (const p of patterns) {
        if (version.includes(p.pattern)) {
          prohibited = true;
          reason = p.reason;
          break;
        }
      }
    }
    
    res.json({
      code: 200,
      data: {
        isValid: isValid && !prohibited,
        version,
        prohibited,
        reason,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
