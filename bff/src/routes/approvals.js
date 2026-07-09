import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

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

// 获取待我审批列表
router.get('/pending', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = db('approvals')
      .where('status', 'pending');

    if (type) {
      query = query.where('operation_type', type);
    }

    // 单独构建 count 查询避免 GROUP BY 冲突
    let countQuery = db('approvals').where('status', 'pending');
    if (type) countQuery = countQuery.where('operation_type', type);
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

// 获取审批详情
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const approval = await db('approvals').where('approval_id', id).first();
    
    if (!approval) {
      return res.status(404).json({ code: 404, message: '审批不存在' });
    }
    
    // 获取审批记录
    const records = await db('approval_records')
      .where('approval_id', id)
      .orderBy('action_time', 'asc');
    
    res.json({
      code: 200,
      data: {
        ...approval,
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
    const { operationType, title, description, repoOwner, repoName, sourceBranch, targetBranch, urgency, secretLevel } = req.body;
    
    const result = await db('approvals').insert({
      operation_type: operationType,
      title,
      description,
      repo_owner: repoOwner,
      repo_name: repoName,
      source_branch: sourceBranch,
      target_branch: targetBranch,
      urgency: urgency || 'normal',
      secret_level: secretLevel || 'internal',
      status: 'pending',
      current_step: 1,
      applicant_user_id: req.user.userId,
      applicant_username: req.user.username,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('approval_id');
    const approvalId = Array.isArray(result) ? result[0]?.approval_id || result[0] : result?.approval_id || result;
    
    res.json({
      code: 200,
      message: '审批申请已提交',
      data: { approvalId },
    });
  } catch (error) {
    next(error);
  }
});

// 处理审批
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
    
    // 更新审批状态
    const newStatus = normalizedAction;
    
    await db('approvals')
      .where('approval_id', id)
      .update({
        status: newStatus,
        updated_at: new Date(),
        completed_at: new Date(),
      });
    
    // 记录审批操作（approval_records 表没有 reviewer_username 列）
    await db('approval_records').insert({
      approval_id: id,
      step: approval.current_step,
      reviewer_user_id: req.user.userId,
      action: normalizedAction,
      comment: body.trim(),
      action_time: new Date(),
    });
    
    res.json({
      code: 200,
      message: normalizedAction === 'approved' ? '审批已通过' : '审批已拒绝',
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

export default router;
