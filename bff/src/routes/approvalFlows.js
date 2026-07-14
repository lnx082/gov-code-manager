/**
 * 审批流程模板管理
 *
 * 【功能】审批流程模板 CRUD、获取建议流程列表
 * 【数据】查询/写入：approval_flows（流程模板）
 * 【来源】openGauss（通过 db()）
 */
import { Router } from 'express';
import { getDb } from '../database/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// 审批流程写操作允许的角色：系统管理员、项目管理员、开发人员、审计人员
const WRITE_ROLES = ['admin', 'project_manager', 'developer', 'auditor'];

/**
 * 获取审批流程模板列表
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, isActive } = req.query;
    const db = getDb();
    let query = db('approval_flows');

    if (isActive !== undefined) {
      query = query.where('is_active', isActive === 'true' ? 1 : 0);
    }

    // 单独构建 count 查询避免 GROUP BY 冲突
    let countQuery = db('approval_flows');
    if (isActive !== undefined) {
      countQuery = countQuery.where('is_active', isActive === 'true' ? 1 : 0);
    }
    const total = await countQuery.count('* as count').first();
    const list = await query
      .orderBy('is_default', 'desc')
      .orderBy('created_at', 'desc')
      .limit(parseInt(pageSize))
      .offset((parseInt(page) - 1) * parseInt(pageSize));

    const formattedList = list.map(item => ({
      id: item.flow_id,
      name: item.name,
      code: item.code,
      description: item.description,
      applicableSecretLevels: parseJson(item.applicable_secret_levels),
      applicableOperations: parseJson(item.applicable_operations),
      steps: parseJson(item.steps),
      isDefault: item.is_default === 1,
      isActive: item.is_active === 1,
      createTime: item.created_at,
      updateTime: item.updated_at
    }));

    res.json({
      code: 200,
      data: {
        list: formattedList,
        total: parseInt(total.count),
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取单个审批流程模板
 */
router.get('/:flowId', authenticate, async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const db = getDb();
    const flow = await db('approval_flows').where('flow_id', flowId).first();

    if (!flow) {
      return res.status(404).json({ code: 404, message: '审批流程不存在' });
    }

    res.json({
      code: 200,
      data: {
        id: flow.flow_id,
        name: flow.name,
        code: flow.code,
        description: flow.description,
        applicableSecretLevels: parseJson(flow.applicable_secret_levels),
        applicableOperations: parseJson(flow.applicable_operations),
        steps: parseJson(flow.steps),
        isDefault: flow.is_default === 1,
        isActive: flow.is_active === 1,
        createTime: flow.created_at,
        updateTime: flow.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建审批流程模板
 */
router.post('/', authenticate, requireRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const { name, code, description, applicableSecretLevels, applicableOperations, steps, isDefault } = req.body;

    if (!name || !code || !steps || steps.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少必要参数: name, code, steps' });
    }

    const db = getDb();

    const existing = await db('approval_flows').where('code', code).first();
    if (existing) {
      return res.status(400).json({ code: 400, message: '流程代码已存在' });
    }

    if (isDefault) {
      await db('approval_flows').where('is_default', 1).update({ is_default: 0 });
    }

    await db('approval_flows').insert({
      name,
      code,
      description,
      applicable_secret_levels: JSON.stringify(applicableSecretLevels || []),
      applicable_operations: JSON.stringify(applicableOperations || []),
      steps: JSON.stringify(steps),
      is_default: isDefault ? 1 : 0,
      is_active: 1,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.json({ code: 200, message: '审批流程模板创建成功' });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新审批流程模板
 */
router.put('/:flowId', authenticate, requireRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const { name, description, applicableSecretLevels, applicableOperations, steps, isDefault, isActive } = req.body;
    const db = getDb();

    const existing = await db('approval_flows').where('flow_id', flowId).first();
    if (!existing) {
      return res.status(404).json({ code: 404, message: '审批流程不存在' });
    }

    if (isDefault) {
      await db('approval_flows').where('is_default', 1).whereNot('flow_id', flowId).update({ is_default: 0 });
    }

    await db('approval_flows').where('flow_id', flowId).update({
      name: name || existing.name,
      description: description !== undefined ? description : existing.description,
      applicable_secret_levels: applicableSecretLevels ? JSON.stringify(applicableSecretLevels) : existing.applicable_secret_levels,
      applicable_operations: applicableOperations ? JSON.stringify(applicableOperations) : existing.applicable_operations,
      steps: steps ? JSON.stringify(steps) : existing.steps,
      is_default: isDefault !== undefined ? (isDefault ? 1 : 0) : existing.is_default,
      is_active: isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
      updated_at: new Date()
    });

    res.json({ code: 200, message: '审批流程模板更新成功' });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除审批流程模板
 */
router.delete('/:flowId', authenticate, requireRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const db = getDb();

    const hasApprovals = await db('approvals').where('approval_flow_id', flowId).whereNotIn('status', ['completed', 'rejected', 'cancelled']).first();
    if (hasApprovals) {
      return res.status(400).json({ code: 400, message: '该流程存在待处理的审批单，无法删除' });
    }

    await db('approval_flows').where('flow_id', flowId).update({ is_active: 0 });
    res.json({ code: 200, message: '审批流程模板已停用' });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取适用的审批流程
 */
router.get('/suggest/list', authenticate, async (req, res, next) => {
  try {
    const { secretLevel, operationType } = req.query;
    const db = getDb();

    const flows = await db('approval_flows').where('is_active', 1).orderBy('is_default', 'desc');

    const applicableFlows = flows.filter(flow => {
      const levels = parseJson(flow.applicable_secret_levels);
      const operations = parseJson(flow.applicable_operations);
      const levelMatch = !secretLevel || levels.length === 0 || levels.includes(secretLevel);
      const operationMatch = !operationType || operations.length === 0 || operations.includes(operationType);
      return levelMatch && operationMatch;
    });

    res.json({
      code: 200,
      data: applicableFlows.map(flow => ({
        id: flow.flow_id,
        name: flow.name,
        code: flow.code,
        description: flow.description,
        steps: parseJson(flow.steps),
        isDefault: flow.is_default === 1
      }))
    });
  } catch (error) {
    next(error);
  }
});

function parseJson(value) {
  if (!value) return [];
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export default router;
