import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

// 获取提交差异（服务端计算，必须在通配符 /* 之前定义）
router.get('/commit-diff/:owner/:repo/:sha', authenticate, async (req, res, next) => {
  try {
    const { owner, repo, sha } = req.params;
    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken || req.headers.authorization || '';

    const commitResp = await fetch(`${config.gitea.url}/api/v1/repos/${owner}/${repo}/git/commits/${sha}`, {
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    });
    if (!commitResp.ok) return res.status(commitResp.status).json({ error: '获取提交失败' });
    const commit = await commitResp.json();

    const files = commit.files || [];
    const parentSha = commit.parents?.[0]?.sha || '';
    const result = {
      sha, message: commit.commit?.message || '',
      author: commit.author?.name || commit.commit?.author?.name || '',
      date: commit.commit?.author?.date || '',
      stats: commit.stats || {}, files: []
    };

    for (const f of files) {
      const filename = f.filename || f.name || '';
      const entry = { name: filename, status: f.status || 'modified', additions: 0, deletions: 0, lines: [] };
      try {
        let oldText = '', newText = '';
        if ((f.status === 'modified' || f.status === 'changed') && parentSha) {
          const [oldR, newR] = await Promise.all([
            fetch(`${config.gitea.url}/api/v1/repos/${owner}/${repo}/raw/${encodeURIComponent(filename)}?ref=${parentSha}`, { headers: { 'Authorization': authHeader } }),
            fetch(`${config.gitea.url}/api/v1/repos/${owner}/${repo}/raw/${encodeURIComponent(filename)}?ref=${sha}`, { headers: { 'Authorization': authHeader } })
          ]);
          if (oldR.ok) oldText = await oldR.text();
          if (newR.ok) newText = await newR.text();
        } else if (f.status === 'added' || f.status === 'add') {
          const newR = await fetch(`${config.gitea.url}/api/v1/repos/${owner}/${repo}/raw/${encodeURIComponent(filename)}?ref=${sha}`, { headers: { 'Authorization': authHeader } });
          if (newR.ok) newText = await newR.text();
        } else if (f.status === 'removed' || f.status === 'deleted' && parentSha) {
          const oldR = await fetch(`${config.gitea.url}/api/v1/repos/${owner}/${repo}/raw/${encodeURIComponent(filename)}?ref=${parentSha}`, { headers: { 'Authorization': authHeader } });
          if (oldR.ok) oldText = await oldR.text();
        }

        if (oldText || newText) {
          const oldLines = oldText.split('\n'), newLines = newText.split('\n');
          let oi = 0, ni = 0, adds = 0, dels = 0;
          while (oi < oldLines.length || ni < newLines.length) {
            if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
              entry.lines.push({ t: ' ', c: oldLines[oi] }); oi++; ni++;
            } else {
              let found = false;
              for (let l = 1; l < 15 && oi + l < oldLines.length; l++) {
                if (oldLines[oi + l] === newLines[ni]) {
                  for (let d = 0; d < l; d++) { entry.lines.push({ t: '-', c: oldLines[oi + d] }); dels++; }
                  oi += l; found = true; break;
                }
              }
              if (!found) {
                for (let l = 1; l < 15 && ni + l < newLines.length; l++) {
                  if (newLines[ni + l] === oldLines[oi]) {
                    for (let d = 0; d < l; d++) { entry.lines.push({ t: '+', c: newLines[ni + d] }); adds++; }
                    ni += l; found = true; break;
                  }
                }
              }
              if (!found) {
                if (oi < oldLines.length) { entry.lines.push({ t: '-', c: oldLines[oi] }); oi++; dels++; }
                if (ni < newLines.length) { entry.lines.push({ t: '+', c: newLines[ni] }); ni++; adds++; }
              }
            }
          }
          entry.additions = adds; entry.deletions = dels;
        }
      } catch (e) { /* skip */ }
      result.files.push(entry);
    }
    res.json({ code: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// 代理到 Gitea API（通配符路由，必须放在最后）
router.all('/*', authenticate, async (req, res, next) => {
  try {
    const giteaPath = req.path;
    let giteaUrl = `${config.gitea.url}/api/v1${giteaPath}`;
    const queryString = new URLSearchParams(req.query).toString();
    if (queryString) giteaUrl += '?' + queryString;

    const giteaToken = req.user?.giteaToken || '';
    const authHeader = giteaToken || req.headers.authorization || '';

    const fetchOptions = {
      method: req.method,
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(giteaUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.set('Content-Type', contentType);
      res.status(response.status).send(text);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
