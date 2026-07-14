/**
 * 分支管理（Gitea 代理：分支/PR CRUD）
 *
 * 【功能】分支列表/创建/删除、Pull Request 创建/合并/关闭
 *        所有操作通过 Gitea API 代理，不操作本地数据库
 * 【数据】无（不操作本地数据库）
 * 【来源】Gitea API（通过 fetch() 代理所有请求）
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

// 从 JWT 中提取 Gitea 认证头
function giteaAuth(req) {
  const giteaToken = req.user?.giteaToken || '';
  return giteaToken.startsWith('Basic ')
    ? giteaToken
    : `token ${giteaToken}`;
}

// 获取分支列表
router.get('/:owner/:repo/branches', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    
    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/branches?page=${page}&limit=${pageSize}`,
      {
        headers: {
          'Authorization': giteaAuth(req),
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

// 创建分支
router.post('/:owner/:repo/branches', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    // Gitea API 参数：new_branch_name 和 old_branch_name
    const { new_branch_name, old_branch_name, new_branch, old_branch } = req.body;
    
    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/branches`,
      {
        method: 'POST',
        headers: {
          'Authorization': giteaAuth(req),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_branch_name: new_branch_name || new_branch,
          old_branch_name: old_branch_name || old_branch,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '创建分支失败');
    }
    
    const branch = await response.json();
    
    res.json({
      code: 200,
      message: '分支创建成功',
      data: branch,
    });
  } catch (error) {
    next(error);
  }
});

// 删除分支
router.delete('/:owner/:repo/branches/:branch', authenticate, async (req, res, next) => {
  try {
    const { owner, repo, branch } = req.params;
    
    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': giteaAuth(req),
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('删除分支失败');
    }
    
    res.json({
      code: 200,
      message: '分支删除成功',
    });
  } catch (error) {
    next(error);
  }
});

// 获取合并请求列表
router.get('/:owner/:repo/pulls', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { page = 1, pageSize = 20, state } = req.query;
    
    const url = `${config.gitea.url}/api/v1/repos/${owner}/${repo}/pulls?page=${page}&limit=${pageSize}${state ? `&state=${state}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': giteaAuth(req),
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('获取合并请求失败');
    }
    
    const pullRequests = await response.json();
    
    res.json({
      code: 200,
      data: {
        list: pullRequests,
        total: pullRequests.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 创建合并请求
router.post('/:owner/:repo/pulls', authenticate, async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { title, description, head, base } = req.body;
    
    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': giteaAuth(req),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body: description,
          head,
          base,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '创建合并请求失败');
    }
    
    const pr = await response.json();
    
    res.json({
      code: 200,
      message: '合并请求创建成功',
      data: pr,
    });
  } catch (error) {
    next(error);
  }
});

// 合并合并请求
router.post('/:owner/:repo/pulls/:index/merge', authenticate, async (req, res, next) => {
  try {
    const { owner, repo, index } = req.params;
    
    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/pulls/${index}/merge`,
      {
        method: 'POST',
        headers: {
          'Authorization': giteaAuth(req),
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('合并失败');
    }
    
    res.json({
      code: 200,
      message: '合并成功',
    });
  } catch (error) {
    next(error);
  }
});

// 获取 PR 变更文件列表
router.get('/:owner/:repo/pulls/:index/files', authenticate, async (req, res, next) => {
  try {
    const { owner, repo, index } = req.params;
    
    const response = await fetch(
      `${config.gitea.url}/api/v1/repos/${owner}/${repo}/pulls/${index}/files`,
      {
        headers: {
          'Authorization': giteaAuth(req),
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('获取文件变更失败');
    }
    
    const files = await response.json();
    
    res.json({
      code: 200,
      data: files,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
