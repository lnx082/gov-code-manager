import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

// 代理到 Gitea API
router.all('/*', authenticate, async (req, res, next) => {
  try {
    const giteaPath = req.path;
    const giteaUrl = `${config.gitea.url}/api/v1${giteaPath}`;
    
    const response = await fetch(giteaUrl, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
