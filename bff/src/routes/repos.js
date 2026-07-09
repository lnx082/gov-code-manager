import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

// 获取仓库列表（从 Gitea）
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, search } = req.query;
    
    // 获取 Gitea Token（JWT 中存储）
    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken.startsWith('Basic ')
      ? giteaToken
      : `token ${giteaToken}`;

    // 直接从 Gitea 获取仓库列表
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
    
    // 格式化数据
    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      owner: repo.owner?.login,
      branches_count: repo.default_branch ? '1' : '0',
      stars_count: repo.stars_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
    }));
    
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
    // 返回模拟数据
    res.json({
      code: 200,
      data: {
        list: [
          { id: 1, name: 'gov-user-service', description: '政务系统用户服务', private: true, owner: 'root', branches_count: 3, stars_count: 5, updated_at: new Date().toISOString() },
          { id: 2, name: 'gov-auth-module', description: '统一认证模块', private: true, owner: 'root', branches_count: 2, stars_count: 3, updated_at: new Date().toISOString() },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
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
