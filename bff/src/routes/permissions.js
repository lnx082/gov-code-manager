/**
 * 权限定义列表
 *
 * 【功能】返回所有可用权限的列表（分类展示）
 * 【数据】查询：permissions（权限定义表）
 * 【来源】openGauss（通过 db()）
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 获取权限列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const permissions = [
      { code: 'repo:view', name: '查看仓库', category: '仓库管理' },
      { code: 'repo:create', name: '创建仓库', category: '仓库管理' },
      { code: 'repo:edit', name: '编辑仓库', category: '仓库管理' },
      { code: 'repo:delete', name: '删除仓库', category: '仓库管理' },
      { code: 'branch:view', name: '查看分支', category: '分支管理' },
      { code: 'branch:create', name: '创建分支', category: '分支管理' },
      { code: 'branch:delete', name: '删除分支', category: '分支管理' },
      { code: 'version:view', name: '查看版本', category: '版本管理' },
      { code: 'version:create', name: '创建版本', category: '版本管理' },
      { code: 'baseline:view', name: '查看基线', category: '基线管理' },
      { code: 'baseline:create', name: '创建基线', category: '基线管理' },
      { code: 'approval:view', name: '查看审批', category: '审批管理' },
      { code: 'approval:create', name: '创建审批', category: '审批管理' },
      { code: 'approval:process', name: '处理审批', category: '审批管理' },
      { code: 'audit:view', name: '查看审计', category: '审计管理' },
      { code: 'report:view', name: '查看报表', category: '审计管理' },
      { code: 'admin:manage', name: '系统管理', category: '系统管理' },
    ];
    
    res.json({ code: 200, data: permissions });
  } catch (error) {
    next(error);
  }
});

export default router;
