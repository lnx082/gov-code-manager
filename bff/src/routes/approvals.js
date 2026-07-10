import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';
import { executeBaselineCreate } from './baselines.js';

const router = Router();

// 获取审批列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('approvals');

    if (status) {
      query = query.where('status', status);
    }
    if (type) {
      query = query.where('operation_type', type);
    }

    // 如果是获取我的申请
    if (req.query.applicantUserId === 'me') {
      query = query.where('applicant_user_id', req.user.userId);
    }

    // 单独构建 count 查询避免 select * + count(*) 的 GROUP BY 冲突
    let countQuery = db('approvals');
    if (status) countQuery = countQuery.where('status', status);
    if (type) countQuery = countQuery.where('operation_type', type);
    if (req.query.applicantUserId === 'me') countQuery = countQuery.where('applicant_user_id', req.user.userId);
    const total = await countQuery.count('* as count').first();

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

// 步骤名 → 角色码映射
function getRoleForStep(stepName) {
  if (!stepName) return null;
  const s = stepName.trim();
  if (s.includes('系统管理员')) return 'admin';
  if (s.includes('项目管理员')) return 'project_manager';
  if (s.includes('开发人员')) return 'developer';
  if (s.includes('审计')) return 'auditor';
  return null;
}

// 获取待我审批列表
router.get('/pending', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, type } = req.query;
    const userRole = req.user.roleCode || 'user';
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'project_manager';

    // 只查询 pending 状态
    let query = db('approvals').where('status', 'pending');

    if (type) {
      query = query.where('operation_type', type);
    }

    const allPending = await query.orderBy('created_at', 'desc');

    // 按用户角色过滤：只展示当前步骤需要当前用户审批的申请
    const filtered = [];
    for (const approval of allPending) {
      // 加载审批流程步骤
      let steps = [];
      if (approval.approval_flow_id) {
        const flow = await db('approval_flows').where('flow_id', approval.approval_flow_id).first();
        if (flow) {
          try {
            steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps || []);
          } catch { steps = []; }
        }
      }

      const currentStepIdx = (approval.current_step || 1) - 1;
      const currentStepName = steps[currentStepIdx] || '';
      const requiredRole = getRoleForStep(currentStepName);

      // 按角色过滤：每人只看自己负责的步骤
      if (requiredRole && requiredRole === userRole) {
        filtered.push(approval);
      }
      // 兼容无审批流程的旧数据：管理员可见
      else if (!approval.approval_flow_id && isAdmin) {
        filtered.push(approval);
      }
    }

    const total = filtered.length;
    const paged = filtered.slice(
      (parseInt(page) - 1) * parseInt(pageSize),
      parseInt(page) * parseInt(pageSize)
    );

    res.json({
      code: 200,
      data: {
        list: paged,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 按 Gitea PR 编号查询审批状态
router.get('/by-pr/:prNumber', authenticate, async (req, res, next) => {
  try {
    const { prNumber } = req.params;
    const approval = await db('approvals')
      .where('gitea_pr_number', parseInt(prNumber))
      .orderBy('created_at', 'desc')
      .first();

    if (!approval) {
      return res.json({ code: 200, data: null });
    }

    res.json({
      code: 200,
      data: {
        approvalId: approval.approval_id,
        status: approval.status,
        title: approval.title,
        createdAt: approval.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取合并请求列表（merge.vue 的主数据源，不依赖 Gitea API）
router.get('/merge-requests', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 50, status } = req.query;

    let query = db('approvals')
      .where('operation_type', 'merge');

    if (status) {
      query = query.where('status', status);
    }

    const countQuery = db('approvals')
      .where('operation_type', 'merge');
    if (status) countQuery.where('status', status);
    const total = await countQuery.count('* as count').first();

    const list = await query
      .orderBy('created_at', 'desc')
      .limit(parseInt(pageSize))
      .offset((parseInt(page) - 1) * parseInt(pageSize));

    const formatted = list.map(item => ({
      id: item.gitea_pr_number || item.approval_id,
      number: item.gitea_pr_number || item.approval_id,
      title: item.title,
      description: item.description,
      sourceBranch: item.source_branch,
      targetBranch: item.target_branch,
      repoName: item.repo_owner ? `${item.repo_owner}/${item.repo_name}` : (item.repo_name || ''),
      owner: item.repo_owner,
      repo: item.repo_name,
      status: item.status,
      state: item.status === 'approved' || item.status === 'rejected' ? 'open' : 'open',
      merged: item.status === 'merged',
      approvals: item.status === 'approved' ? 1 : 0,
      requiredApprovals: 1,
      approvalRate: item.status === 'approved' ? 100 : (item.status === 'rejected' ? 0 : 0),
      author: item.applicant_username,
      createdAt: item.created_at,
      bffApprovalId: item.approval_id,
      approvalRecords: [],
      additions: 0,
      deletions: 0,
      fileChanges: 0,
      files: [],
    }));

    res.json({
      code: 200,
      data: {
        list: formatted,
        total: parseInt(total.count),
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取审批统计
router.get('/stats/summary', authenticate, async (req, res, next) => {
  try {
    const pending = await db('approvals').where('status', 'pending').count('* as count').first();
    const approved = await db('approvals').where('status', 'approved').count('* as count').first();
    const rejected = await db('approvals').where('status', 'rejected').count('* as count').first();

    res.json({
      code: 200,
      data: {
        pending: parseInt(pending.count),
        approved: parseInt(approved.count),
        rejected: parseInt(rejected.count),
        total: parseInt(pending.count) + parseInt(approved.count) + parseInt(rejected.count),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============ 动态参数路由：必须放在所有具体路径之后（:id 会匹配任何路径片段）============

// 获取审批详情（按ID）
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const approval = await db('approvals').where('approval_id', id).first();
    
    if (!approval) {
      return res.status(404).json({ code: 404, message: '审批不存在' });
    }
    
    // 获取审批记录（含审批人名称）
    const records = await db('approval_records')
      .select('approval_records.*', 'user_profiles.gitea_username as reviewer_name')
      .leftJoin('user_profiles', 'approval_records.reviewer_user_id', 'user_profiles.user_id')
      .where('approval_records.approval_id', id)
      .orderBy('approval_records.action_time', 'asc');

    // 获取审批流程步骤
    let steps = ['提交申请', '审批通过'];
    let totalSteps = 2;
    if (approval.approval_flow_id) {
      const flow = await db('approval_flows').where('flow_id', approval.approval_flow_id).first();
      if (flow) {
        try {
          steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps || []);
          totalSteps = steps.length;
        } catch { /* use defaults */ }
      }
    }

    res.json({
      code: 200,
      data: {
        ...approval,
        steps,
        totalSteps,
        approval_records: records,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 创建审批申请
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { operationType, title, description, repoOwner, repoName, sourceBranch, targetBranch, urgency, secretLevel, giteaPrNumber, approvalFlowId, body } = req.body;

    // 未指定审批流程时，自动使用默认流程
    let flowId = approvalFlowId || null;
    if (!flowId) {
      const defaultFlow = await db('approval_flows')
        .where('is_default', true)
        .where('is_active', true)
        .first();
      if (defaultFlow) flowId = defaultFlow.flow_id;
    }

    // 将操作参数 JSON 附在 description 末尾，供审批通过后使用
    const fullDescription = body
      ? (description ? description + '\n<!--BODY ' + body + ' BODY-->' : '<!--BODY ' + body + ' BODY-->')
      : description;

    const [insertId] = await db('approvals').insert({
      operation_type: operationType,
      title,
      description: fullDescription,
      repo_owner: repoOwner,
      repo_name: repoName,
      source_branch: sourceBranch,
      target_branch: targetBranch,
      urgency: urgency || 'normal',
      secret_level: secretLevel || 'internal',
      gitea_pr_number: giteaPrNumber || null,
      approval_flow_id: flowId,
      status: 'pending',
      current_step: 1,
      applicant_user_id: req.user.userId,
      applicant_username: req.user.username,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('approval_id');

    res.json({
      code: 200,
      message: '审批申请已提交',
      data: {
        approvalId: insertId,
        approvalFlowId: flowId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 处理审批（支持多步审批流程）
router.post('/:id/process', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, body } = req.body;

    // 兼容 Gitea 格式 (APPROVE/REJECT) 和其他格式 (approved/rejected)
    const normalizedAction = action === 'APPROVE' || action === 'approved' ? 'approved' :
                            action === 'REJECT' || action === 'rejected' ? 'rejected' : action;

    // 审批意见不能为空
    if (!body || body.trim() === '') {
      return res.status(400).json({
        code: 400,
        message: '审批意见不能为空，请填写审批说明'
      });
    }

    const approval = await db('approvals').where('approval_id', id).first();
    if (!approval) {
      return res.status(404).json({ code: 404, message: '审批不存在' });
    }

    // 检查是否已处理过
    if (approval.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        message: `该审批已处理，当前状态：${approval.status}`
      });
    }

    // 获取审批流程定义（获取总步数）
    let totalSteps = 1;
    if (approval.approval_flow_id) {
      const flow = await db('approval_flows').where('flow_id', approval.approval_flow_id).first();
      if (flow) {
        const steps = typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps || []);
        totalSteps = steps.length || 1;
      }
    }

    // 记录审批操作
    await db('approval_records').insert({
      approval_id: id,
      step: approval.current_step,
      reviewer_user_id: req.user.userId,
      action: normalizedAction,
      comment: body.trim(),
      action_time: new Date(),
    });

    if (normalizedAction === 'rejected') {
      // 拒绝：直接结束
      await db('approvals').where('approval_id', id).update({
        status: 'rejected',
        updated_at: new Date(),
        completed_at: new Date(),
      });
      return res.json({ code: 200, message: '审批已拒绝' });
    }

    // 通过：检查是否还有后续步骤
    const nextStep = approval.current_step + 1;
    if (nextStep <= totalSteps) {
      // 还有下一步 → 进入下一轮审批
      await db('approvals').where('approval_id', id).update({
        current_step: nextStep,
        status: 'pending',  // 保持 pending，等待下一步审批人
        updated_at: new Date(),
      });
      return res.json({
        code: 200,
        message: `审批已通过（第 ${approval.current_step} 步），等待第 ${nextStep} 步审批`,
        data: { nextStep, totalSteps }
      });
    }

    // 所有步骤完成 → 最终通过 + 执行后置操作
    await db('approvals').where('approval_id', id).update({
      status: 'approved',
      updated_at: new Date(),
      completed_at: new Date(),
    });

    // 审批全部通过后，执行实际业务操作（如发布版本）
    try {
      await executePostApprovalAction(approval);
    } catch (postErr) {
      console.error('后置操作失败:', postErr.message);
    }

    res.json({
      code: 200,
      message: '审批全部通过，操作已执行',
    });
  } catch (error) {
    next(error);
  }
});

// 审批通过后的后置操作：创建 Gitea tag / release
async function executePostApprovalAction(approval) {
  const giteaUrl = config.gitea?.url || 'http://123.60.219.19:3000';
  const adminToken = config.gitea?.token || '';

  // 从 description 中解析操作参数（格式：<!--BODY {json} BODY-->）
  let bodyData = {};
  try {
    const desc = approval.description || '';
    const m = desc.match(/<!--BODY (.+?) BODY-->/);
    if (m) bodyData = JSON.parse(m[1]);
  } catch { bodyData = {}; }

  if (approval.operation_type === 'version_release') {
    const { repoOwner, repoName, tagName, releaseTitle, releaseBody, targetBranch, prerelease } = bodyData;
    if (!repoOwner || !repoName || !tagName) {
      console.error('[PostApproval] 缺少版本发布参数:', bodyData);
      return;
    }
    const authHeader = adminToken.startsWith('Basic ') ? adminToken : (adminToken ? `token ${adminToken}` : '');

    // 1. 创建 tag
    const tagRes = await fetch(`${giteaUrl}/api/v1/repos/${repoOwner}/${repoName}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ tag_name: tagName, message: releaseBody || tagName, target: targetBranch || 'main' }),
    });
    if (!tagRes.ok) {
      const err = await tagRes.text();
      console.error(`[PostApproval] Tag 创建失败: ${tagRes.status} ${err}`);
      return;
    }
    console.log(`[PostApproval] Tag ${tagName} 创建成功`);

    // 2. 创建 release
    try {
      await fetch(`${giteaUrl}/api/v1/repos/${repoOwner}/${repoName}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          tag_name: tagName, name: releaseTitle || tagName, body: releaseBody || '',
          target_commitish: targetBranch || 'main', prerelease: prerelease || false,
        }),
      });
      console.log(`[PostApproval] Release ${tagName} 创建成功`);
    } catch (e) {
      console.warn('[PostApproval] Release 创建失败（tag 已创建）:', e.message);
    }
  } else if (approval.operation_type === 'baseline_create') {
    await executeBaselineCreate(approval);
  }
}

export default router;
