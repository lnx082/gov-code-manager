import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

// 代理到 Gitea API（前端 Gitea API 调用统一入口，解决跨域问题）
router.all('/*', authenticate, async (req, res, next) => {
  try {
    const giteaPath = req.path;
    const giteaUrl = `${config.gitea.url}/api/v1${giteaPath}`;

    // 从 JWT 中提取 giteaToken（Basic Auth 凭证）
    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken || req.headers.authorization || '';

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    };

    // 有请求体时添加 body
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(giteaUrl, fetchOptions);

    // 处理不同类型的响应
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    next(error);
  }
});

// 特殊处理：PR 审批需要返回统一的响应格式
router.post('/repos/:owner/:repo/pulls/:index/reviews', authenticate, async (req, res, next) => {
  try {
    const { owner, repo, index } = req.params;
    const { event, body } = req.body;

    // 验证 event 参数
    const validEvents = ['APPROVE', 'REJECT', 'REQUEST_REVIEW', 'COMMENT', 'PENDING'];
    const reviewEvent = validEvents.includes(event) ? event : 'APPROVE';

    // Gitea 要求 APPROVE/REJECT 必须有审批意见（body 不能为空）
    const approvalBody = body ? body.trim() : '';
    if ((reviewEvent === 'APPROVE' || reviewEvent === 'REJECT') && !approvalBody) {
      return res.status(400).json({
        code: 400,
        message: '审批意见不能为空，请填写审批说明',
      });
    }

    const giteaUrl = `${config.gitea.url}/api/v1/repos/${owner}/${repo}/pulls/${index}/reviews`;
    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken || req.headers.authorization || '';

    const response = await fetch(giteaUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: reviewEvent,
        body: approvalBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        code: response.status,
        message: errorData.message || `审批失败 (HTTP ${response.status})`,
      });
    }

    const result = await response.json();

    res.json({
      code: 200,
      message: reviewEvent === 'APPROVE' ? '审批已通过' : reviewEvent === 'REJECT' ? '审批已拒绝' : '评论已提交',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// 获取 PR 审批记录
router.get('/repos/:owner/:repo/pulls/:index/reviews', authenticate, async (req, res, next) => {
  try {
    const { owner, repo, index } = req.params;

    const giteaUrl = `${config.gitea.url}/api/v1/repos/${owner}/${repo}/pulls/${index}/reviews`;
    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken || req.headers.authorization || '';

    const response = await fetch(giteaUrl, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('获取审批记录失败');
    }

    const reviews = await response.json();

    res.json({
      code: 200,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
