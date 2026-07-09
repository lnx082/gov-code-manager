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

export default router;
