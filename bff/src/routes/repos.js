/**
 * 仓库列表查询（Gitea 代理 + 部门隔离 + 密级权限过滤）
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';
import db from '../database/connection.js';

const router = Router();

// 密级权重（值越大权限越高）
const SECRET_WEIGHT = { public: 0, secret: 1, confidential: 2, 'top-secret': 3 };

/**
 * 判断用户是否有权限访问该密级的仓库
 */
function canAccessByLevel(userLevel, repoLevel) {
  const uw = SECRET_WEIGHT[userLevel];
  const rw = SECRET_WEIGHT[repoLevel];
  if (uw === undefined || rw === undefined) return true; // 未知密级默认放行
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

    // 获取所有用户部门映射（用于确定仓库主管部门）
    const allUsers = await db('user_profiles')
      .select('user_profiles.gitea_username', 'user_profiles.department_id', 'departments.name as department_name')
      .leftJoin('departments', 'user_profiles.department_id', 'departments.dept_id')
      .whereNotNull('user_profiles.department_id');

    const userDeptMap = {};
    for (const u of allUsers) {
      userDeptMap[u.gitea_username?.toLowerCase()] = {
        department_id: u.department_id,
        department_name: u.department_name || '-',
      };
    }

    // 格式化 + 权限过滤
    const formattedRepos = repos
      .map(repo => {
        const ownerName = repo.owner?.login || '';
        const repoDeptFromOwner = userDeptMap[ownerName.toLowerCase()] || null;
        const desc = repo.description || '';
        const repoSecret = parseSecretLevel(desc);
        // 优先使用描述中的 [部门=xxx] 标签，否则使用创建者的部门
        const storedDeptName = parseDepartment(desc);
        const repoDept = storedDeptName
          ? { department_id: repoDeptFromOwner?.department_id || null, department_name: storedDeptName }
          : repoDeptFromOwner;

        return {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: desc,
          private: repo.private,
          owner: ownerName,
          branches_count: repo.default_branch ? '1' : '0',
          stars_count: repo.stars_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          // 扩展字段
          _department_id: repoDept?.department_id || null,
          _department_name: repoDept?.department_name || '-',
          _secret_level: repoSecret,
        };
      })
      .filter(repo => {
        // 管理员 —— 不过滤
        if (isAdmin) return true;

        // 部门隔离：仓库无部门信息时放行（owner 不在 user_profiles 中），有部门则必须匹配
        if (repo._department_id && repo._department_id !== userDeptId) {
          return false;
        }

        // 密级管控：用户密级 >= 仓库密级
        if (!canAccessByLevel(userSecretLevel, repo._secret_level)) {
          return false;
        }

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
