/**
 * 下载 Token 路由 — 为当前用户创建/返回 Gitea 访问令牌用于下载 ZIP
 *
 * 【功能】为当前用户创建/查询 Gitea 访问令牌（用于仓库 ZIP 下载免登录）
 *        优先使用用户自己的 Basic Auth 调用 Gitea API（无需管理员权限）
 * 【数据】不操作本地数据库
 * 【来源】Gitea API（通过 fetch() 创建/查询 Token）
 */
 *       如果用户 token 不可用，则降级使用管理员 token 调用 Admin API。
 *       若均失败，返回详细的失败原因便于排查。
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';
import db from '../database/connection.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const username = req.user.username;
    const userToken = req.user?.giteaToken || '';  // 用户自己的 Basic Auth

    // 1. 检查 user_profiles 中是否已有缓存的 download token
    const profile = await db('user_profiles').where('user_id', userId).first();

    if (profile && profile.gitea_download_token) {
      return res.json({
        code: 200,
        data: { token: profile.gitea_download_token },
      });
    }

    // 2. 调用 Gitea API 创建 token
    //    优先使用用户自己的凭据（无需管理员权限），失败时降级为管理员 API
    let sha1 = null;
    let userApiStatus = null;
    let adminApiStatus = null;

    if (userToken) {
      const result = await createTokenViaUserAPI(username, userToken);
      sha1 = result.token;
      userApiStatus = result.status;
    }

    // 降级：用户 API 失败，尝试管理员 API
    if (!sha1) {
      const adminToken = config.gitea?.token;
      if (adminToken) {
        const result = await createTokenViaAdminAPI(username, adminToken);
        sha1 = result.token;
        adminApiStatus = result.status;
      } else {
        adminApiStatus = 'no_admin_token';
      }
    }

    if (!sha1) {
      // 构造详细的错误信息
      let detail = '';
      if (!userToken) {
        detail = '用户凭据缺失（JWT 中无 giteaToken）';
      } else if (userApiStatus === 404) {
        detail = 'Gitea 版本可能过低（需 ≥1.19），不支持用户自建 Token API';
      } else if (userApiStatus === 401) {
        detail = '用户凭据已过期（密码可能已在 Gitea 中修改），且管理员 API 亦不可用';
      } else if (adminApiStatus === 'no_admin_token') {
        detail = 'GITEA_ADMIN_TOKEN 未配置';
      } else {
        detail = `用户 API 返回 ${userApiStatus}，管理员 API 返回 ${adminApiStatus}`;
      }

      console.error(`[DownloadToken] 创建失败 — user=${username} userApi=${userApiStatus} adminApi=${adminApiStatus}`);
      return res.status(500).json({
        code: 500,
        message: `创建下载令牌失败：${detail}`,
      });
    }

    // 3. 存入 user_profiles 以便后续复用
    await db('user_profiles')
      .where('user_id', userId)
      .update({
        gitea_download_token: sha1,
        updated_at: new Date(),
      });

    console.log(`[DownloadToken] 创建成功 — user=${username} source=${adminApiStatus ? 'admin' : 'user'}`);

    res.json({
      code: 200,
      data: { token: sha1 },
    });
  } catch (error) {
    console.error('[DownloadToken] 错误:', error);
    next(error);
  }
});

/**
 * 通过用户自己的 Basic Auth 创建 token（推荐方式，无需管理员权限）
 * POST /api/v1/users/{username}/tokens（Gitea ≥1.19 才支持）
 * @returns {{ token: string|null, status: number|null }}
 */
async function createTokenViaUserAPI(username, userToken) {
  try {
    const authHeader = userToken.startsWith('Basic ') || userToken.startsWith('Bearer ')
      ? userToken
      : `Basic ${userToken}`;

    const res = await fetch(
      `${config.gitea.url}/api/v1/users/${encodeURIComponent(username)}/tokens`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'download-token',
          scopes: ['read:repository'],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[DownloadToken] 用户 API 失败 (${res.status}): ${errText.substring(0, 200)}`);
      return { token: null, status: res.status };
    }

    const data = await res.json();
    return { token: data.sha1 || null, status: res.status };
  } catch (err) {
    console.warn('[DownloadToken] 用户 API 请求异常:', err.message);
    return { token: null, status: null };
  }
}

/**
 * 通过管理员 Token 创建用户 token（降级方案）
 * POST /api/v1/admin/users/{username}/tokens
 * @returns {{ token: string|null, status: number|null }}
 */
async function createTokenViaAdminAPI(username, adminToken) {
  try {
    const authHeader = adminToken.startsWith('Basic ') || adminToken.startsWith('Bearer ')
      ? adminToken
      : `Bearer ${adminToken}`;

    const res = await fetch(
      `${config.gitea.url}/api/v1/admin/users/${encodeURIComponent(username)}/tokens`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'download-token',
          scopes: ['read:repository'],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[DownloadToken] 管理员 API 失败 (${res.status}): ${errText.substring(0, 200)}`);
      return { token: null, status: res.status };
    }

    const data = await res.json();
    return { token: data.sha1 || null, status: res.status };
  } catch (err) {
    console.warn('[DownloadToken] 管理员 API 请求异常:', err.message);
    return { token: null, status: null };
  }
}

export default router;
