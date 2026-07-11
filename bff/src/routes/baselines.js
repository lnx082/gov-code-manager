/**
 * 基线管理 CRUD（锁定/解锁/冻结）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';
import { getRepoVisibilityFilter } from './repoMeta.js';

const router = Router();

// 检查一组 tag 是否为基线（供版本列表使用）
router.get('/check', authenticate, async (req, res, next) => {
  try {
    const { tags } = req.query; // 格式：owner/repo@tagName,owner/repo@tagName
    if (!tags) return res.json({ code: 200, data: {} });
    const tagList = tags.split(',');
    const baselines = await db('baselines')
      .select('repo_owner', 'repo_name', 'tag_name')
      .where('status', 'active');
    const result = {};
    for (const t of tagList) {
      const [repo, tagName] = t.split('@');
      const [owner, repoName] = (repo || '').split('/');
      result[t] = baselines.some(b => b.repo_owner === owner && b.repo_name === repoName && b.tag_name === tagName);
    }
    res.json({ code: 200, data: result });
  } catch (error) { next(error); }
});

// 获取基线列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    // 部门密级过滤
    const filter = await getRepoVisibilityFilter(req.user);
    let query = db('baselines');
    if (status) query = query.where('status', status);
    if (filter) {
      query = query
        .leftJoin('repo_metadata', function () {
          this.on('baselines.repo_owner', 'repo_metadata.repo_owner')
            .andOn('baselines.repo_name', 'repo_metadata.repo_name');
        })
        .where('repo_metadata.department_id', filter.department_id)
        .whereIn('repo_metadata.secret_level', filter.allowed_secret_levels)
        .select('baselines.*');
    }

    let countQuery = db('baselines');
    if (status) countQuery = countQuery.where('status', status);
    if (filter) {
      countQuery = countQuery
        .leftJoin('repo_metadata', function () {
          this.on('baselines.repo_owner', 'repo_metadata.repo_owner')
            .andOn('baselines.repo_name', 'repo_metadata.repo_name');
        })
        .where('repo_metadata.department_id', filter.department_id)
        .whereIn('repo_metadata.secret_level', filter.allowed_secret_levels);
    }
    const total = await countQuery.count('* as count').first();
    const rawList = await query.orderBy('created_at', 'desc')
      .limit(parseInt(pageSize))
      .offset(offset);

    // 批量获取仓库描述以解析中文显示名
    const repoDisplayNames = {};
    const adminToken = config.gitea?.token || '';
    for (const b of rawList) {
      const key = `${b.repo_owner}/${b.repo_name}`;
      if (!repoDisplayNames[key] && b.repo_owner && b.repo_name) {
        try {
          const resp = await fetch(`${config.gitea.url}/api/v1/repos/${b.repo_owner}/${b.repo_name}`, {
            headers: { 'Authorization': adminToken }
          });
          if (resp.ok) {
            const repo = await resp.json();
            const dm = (repo.description || '').match(/\[显示名=([^\]]+)\]/);
            repoDisplayNames[key] = dm ? dm[1] : (repo.full_name || b.repo_name);
          }
        } catch { repoDisplayNames[key] = b.repo_name; }
      }
    }

    // 获取创建者用户名
    const creatorIds = [...new Set(rawList.map(b => b.created_by).filter(Boolean))];
    const creatorMap = {};
    if (creatorIds.length > 0) {
      const profiles = await db('user_profiles').select('user_id', 'gitea_username').whereIn('user_id', creatorIds);
      profiles.forEach(p => { creatorMap[p.user_id] = p.gitea_username; });
    }

    // 映射为前端期望的字段名
    const list = rawList.map(b => ({
      ...b,
      name: b.baseline_name || b.name,
      version: b.tag_name || b.version,
      repoName: b.repo_name || b.repoName,
      displayName: repoDisplayNames[`${b.repo_owner}/${b.repo_name}`] || b.displayName || b.repo_name,
      creator: creatorMap[b.created_by] || String(b.created_by || ''),
      createdAt: b.created_at || b.createdAt,
    }));

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

// 创建基线（提交审批，审批通过后在 approvals.js 后置操作中创建）
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, versionName, repoOwner, repoName, sha, description } = req.body;

    // 同一仓库只能有一个活跃基线
    const existingBaseline = await db('baselines')
      .where('repo_owner', repoOwner).where('repo_name', repoName)
      .where('status', 'active').first();
    if (existingBaseline) {
      return res.status(400).json({ code: 400, message: '该仓库已存在活跃基线，只能变更基线不能重复创建' });
    }

    // 同一仓库不能有多个待审批的基线创建申请
    const pendingApproval = await db('approvals')
      .where('repo_owner', repoOwner).where('repo_name', repoName)
      .where('operation_type', 'baseline_create').where('status', 'pending').first();
    if (pendingApproval) {
      return res.status(400).json({ code: 400, message: '该仓库已有待审批的基线创建申请' });
    }

    // 查找默认审批流程
    const defaultFlow = await db('approval_flows')
      .where('is_default', true).where('is_active', true).first();
    const flowId = defaultFlow?.flow_id || null;

    // 创建审批申请（而非直接创建基线）
    const [insertId] = await db('approvals').insert({
      operation_type: 'baseline_create',
      title: `基线申请: ${name}`,
      description: (description || '') + '\n<!--BODY ' + JSON.stringify({ name, versionName, repoOwner, repoName, sha }) + ' BODY-->',
      repo_owner: repoOwner,
      repo_name: repoName,
      status: 'pending',
      current_step: 1,
      approval_flow_id: flowId,
      applicant_user_id: req.user.userId,
      applicant_username: req.user.username,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('approval_id');

    res.json({
      code: 200,
      message: '基线创建申请已提交，等待审批',
      data: { approvalId: insertId },
    });
  } catch (error) {
    next(error);
  }
});

// 审批通过后的后置操作：创建基线记录
async function executeBaselineCreate(approval) {
  let bodyData = {};
  try {
    const m = (approval.description || '').match(/<!--BODY (.+?) BODY-->/);
    if (m) bodyData = JSON.parse(m[1]);
  } catch { return; }

  // 双重保险：同一仓库只能有一个活跃基线
  const existing = await db('baselines')
    .where('repo_owner', bodyData.repoOwner).where('repo_name', bodyData.repoName)
    .where('status', 'active').first();
  if (existing) {
    console.warn(`[Baseline] 仓库 ${bodyData.repoOwner}/${bodyData.repoName} 已有活跃基线，跳过创建`);
    return;
  }

  await db('baselines').insert({
    baseline_name: bodyData.name,
    tag_name: bodyData.versionName,
    tag_sha: bodyData.sha || null,
    repo_owner: bodyData.repoOwner,
    repo_name: bodyData.repoName,
    description: approval.description?.replace(/<!--BODY.+?BODY-->/, '').trim() || '',
    status: 'active',
    is_locked: true,
    created_by: approval.applicant_user_id,
    approval_id: approval.approval_id,
    created_at: new Date(),
    locked_at: new Date(),
  });
  console.log(`[Baseline] 基线 ${bodyData.name} 审批通过，已创建`);
}

export { executeBaselineCreate };

// 锁定/解锁基线
router.post('/:id/lock', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { locked } = req.body;
    
    await db('baselines')
      .where('baseline_id', id)
      .update({
        is_locked: locked,
        locked_by: locked ? req.user.userId : null,
        locked_at: locked ? new Date() : null,
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
        is_locked: true,
        locked_at: new Date(),
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
