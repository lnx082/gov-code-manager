/**
 * 仓库列表查询（Gitea 代理 + 部门隔离 + 密级权限过滤）
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';
import db from '../database/connection.js';

const router = Router();

// 密级权重（值越大权限越高）
const SECRET_WEIGHT = { public: 0, internal: 1, secret: 2, confidential: 3, 'top-secret': 4 };

/**
 * 判断用户是否有权限访问该密级的仓库（用户密级 >= 仓库密级）
 */
function canAccessByLevel(userLevel, repoLevel) {
  const uw = SECRET_WEIGHT[userLevel];
  const rw = SECRET_WEIGHT[repoLevel];
  if (uw === undefined || rw === undefined) return false; // 未知密级拒绝访问
  return uw >= rw;
}

/**
 * 从描述中解析密级标签
 */
function parseSecretLevel(desc) {
  if (!desc) return 'secret';
  const clean = desc.replace(/^\[显示名=[^\]]+\]/, '').replace(/\[部门=[^\]]+\]/, '');
  const match = clean.match(/\[(公开|秘密|机密|绝密)\]/);
  if (match) {
    const map = { 公开: 'public', 秘密: 'secret', 机密: 'confidential', 绝密: 'top-secret' };
    return map[match[1]] || 'secret';
  }
  return 'secret';
}

/**
 * 从描述中解析部门标签：格式 [部门=网信办]
 */
function parseDepartment(desc) {
  if (!desc) return null;
  const m = desc.match(/\[部门=([^\]]+)\]/);
  return m ? m[1] : null;
}

// 获取仓库列表（带部门 + 密级权限过滤）
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, search } = req.query;

    // 获取当前用户信息（部门、密级）
    const profile = await db('user_profiles')
      .select('user_profiles.department_id', 'user_profiles.secret_level', 'departments.name as department_name')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .where('user_id', req.user.userId)
      .first();

    const isAdmin = req.user.roleCode === 'admin' || req.user.isAdmin === true;
    const userDeptId = profile?.department_id;
    const userDeptName = profile?.department_name || '';
    const userSecretLevel = profile?.secret_level || 'secret';

    // 使用用户自己的 Gitea token（同部门成员已加为协作者，自然能看到对应仓库）
    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken.startsWith('Basic ') ? giteaToken : `token ${giteaToken}`;

    // 从 Gitea 获取仓库列表
    const response = await fetch(
      `${config.gitea.url}/api/v1/user/repos?page=${page}&limit=${pageSize}${search ? `&q=${search}` : ''}`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('获取仓库列表失败');
    }

    const repos = await response.json();

    // 获取 repo_metadata 映射 + 部门名称映射
    const allMeta = await db('repo_metadata').select('*');
    const metaMap = {};
    for (const m of allMeta) {
      metaMap[`${m.repo_owner}/${m.repo_name}`.toLowerCase()] = m;
    }
    const allDepts = await db('departments').select('dept_id', 'name');
    const deptNameMap = {};
    for (const d of allDepts) { deptNameMap[d.dept_id] = d.name; }

    // 格式化 + 权限过滤
    const formattedRepos = repos
      .map(repo => {
        const ownerName = repo.owner?.login || '';
        const repoKey = `${ownerName}/${repo.name}`.toLowerCase();
        const meta = metaMap[repoKey] || null;
        const desc = repo.description || '';

        return {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name || `${ownerName}/${repo.name}`,
          description: desc,
          private: repo.private,
          owner: ownerName,
          branches_count: repo.default_branch ? '1' : '0',
          stars_count: repo.stars_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          _department_id: meta?.department_id || null,
          _department_name: deptNameMap[meta?.department_id] || '-',
          _display_name: meta?.display_name || `${ownerName}/${repo.name}`,
          _secret_level: meta?.secret_level || parseSecretLevel(desc),
        };
      })
      .filter(repo => {
        if (isAdmin) return true;
        // 部门隔离：仓库有部门信息时必须匹配，无部门信息（未配置 metadata）放行
        if (repo._department_id && repo._department_id !== userDeptId) return false;
        // 密级管控
        if (!canAccessByLevel(userSecretLevel, repo._secret_level)) return false;
        return true;
      });

    res.json({
      code: 200,
      data: {
        list: formattedRepos,
        total: formattedRepos.length,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取仓库列表失败:', error);
    // 返回空列表而非模拟数据
    res.json({
      code: 200,
      data: { list: [], total: 0, page: parseInt(req.query.page || 1), pageSize: parseInt(req.query.pageSize || 20) },
    });
  }
});

// 获取仓库详情
router.get('/:owner/:repo', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('获取仓库详情失败');
    }

    const repoData = await response.json();

    res.json({
      code: 200,
      data: repoData,
    });
  } catch (error) {
    next(error);
  }
});

// 获取仓库分支列表
router.get('/:owner/:repo/branches', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/branches?page=${page}&limit=${pageSize}`,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('获取分支列表失败');
    }

    const branches = await response.json();

    res.json({
      code: 200,
      data: {
        list: branches,
        total: branches.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取仓库提交历史
router.get('/:owner/:repo/commits', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { page = 1, pageSize = 20, sha } = req.query;

    const url = `${config.gitea.url}/api/v1/repos/${owner}/${repo}/commits?page=${page}&limit=${pageSize}${sha ? `&sha=${sha}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('获取提交历史失败');
    }

    const commits = await response.json();

    res.json({
      code: 200,
      data: {
        list: commits,
        total: commits.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
