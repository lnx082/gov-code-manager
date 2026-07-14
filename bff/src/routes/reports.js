/**
 * 审计报表管理（生成/下载/删除）
 *
 * 【功能】报表列表查询、生成新报表（可指定类型/日期范围）、下载报表文件、删除报表
 * 【数据】查询/写入：reports（报表记录）
 * 【来源】openGauss（通过 db()）
 */
import { Router } from 'express';
import db from '../database/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = Router();

// 获取报表列表
router.get('/', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const total = await db('reports').count('* as count').first();
    const list = await db('reports')
      .orderBy('created_at', 'desc')
      .limit(parseInt(pageSize))
      .offset(offset);
    
    res.json({
      code: 200,
      data: {
        list,
        total: parseInt(total.count),
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 生成报表
router.post('/generate', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { type, format, startDate, endDate, templateId, name, parameters } = req.body;

    // 兼容前端传递的字段名
    const reportType = type || 'audit';
    const typeNames = { version: '版本变更统计', audit: '操作审计报表', approval: '审批汇总报表', risk: '风险预警报表' };
    const reportName = name || `${typeNames[reportType] || '报表'}_${new Date().toISOString().slice(0, 10)}`;

    await db('reports').insert({
      template_id: 0, // 实际 DB 中为 INTEGER NOT NULL
      name: reportName,
      format: format || 'pdf',
      status: 'generating',
      parameters: parameters || { type: reportType, startDate, endDate },
      created_by: req.user.userId,
      created_at: new Date(),
    });
    // openGauss 兼容：不依赖数组解构，查回刚插入的记录
    let reportId = null;
    try {
      const inserted = await db('reports')
        .where({ created_by: req.user.userId, name: reportName })
        .orderBy('created_at', 'desc')
        .first();
      if (inserted) reportId = inserted.report_id;
    } catch { /* ignore */ }

    // 模拟报表生成（2秒后更新状态）
    if (reportId) {
      setTimeout(async () => {
        try {
          await db('reports').where('report_id', reportId).update({ status: 'completed' });
        } catch { /* ignore */ }
      }, 2000);
    }

    res.json({ code: 200, message: '报表生成中', data: { reportId } });
  } catch (error) {
    next(error);
  }
});

// 下载报表（根据格式返回对应文件类型）
router.get('/:id/export', authenticate, requirePermission('audit:view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await db('reports').where('report_id', id).first();

    if (!report) {
      return res.status(404).json({ code: 404, message: '报表不存在' });
    }

    const fmt = (report.format || 'pdf').toLowerCase();
    const params = typeof report.parameters === 'string' ? JSON.parse(report.parameters) : (report.parameters || {});
    const now = new Date().toISOString().slice(0, 10);
    const baseName = report.name || 'export';

    // 根据报表参数查询审计日志
    let auditQuery = db('audit_logs').orderBy('timestamp', 'desc').limit(200);
    if (params.type && params.type !== 'audit') {
      auditQuery = auditQuery.where('action_type', params.type);
    }
    if (params.startDate) {
      auditQuery = auditQuery.where('timestamp', '>=', params.startDate);
    }
    if (params.endDate) {
      auditQuery = auditQuery.where('timestamp', '<=', params.endDate);
    }
    const auditLogs = await auditQuery;

    // 操作类型名称映射
    const actionNames = {
      login: '登录', view: '查看', create: '创建', update: '更新',
      delete: '删除', approval: '审批', merge: '合并',
      commit: '提交', version: '版本', download: '下载',
    };

    if (fmt === 'excel' || fmt === 'csv' || fmt === 'xlsx') {
      // 生成 CSV（Excel 可打开）
      const rows = [
        ['时间', '用户名', '操作类型', '操作描述', 'IP地址', '结果', '请求路径'],
      ];
      for (const log of auditLogs) {
        rows.push([
          log.timestamp ? new Date(log.timestamp).toLocaleString('zh-CN') : '',
          log.username || '',
          actionNames[log.action_type] || log.action_type || '',
          log.action_name || '',
          log.request_ip || '',
          log.result || '',
          log.request_path || '',
        ]);
      }
      const csv = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const bom = '﻿';
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}_${now}.csv"`,
      });
      return res.send(bom + csv);
    }

    // 默认 PDF — 使用 pdfkit 生成真正的 PDF 文件
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // 注册中文字体（Windows 系统字体）
    const FONT_REGULAR = 'C:/Windows/Fonts/simfang.ttf';
    const FONT_BOLD = 'C:/Windows/Fonts/simhei.ttf';
    try {
      doc.registerFont('CNRegular', FONT_REGULAR);
      doc.registerFont('CNBold', FONT_BOLD);
    } catch (fontErr) {
      console.warn('PDF 字体注册失败:', fontErr.message);
    }

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}_${now}.pdf"`,
        'Content-Length': pdfData.length,
      });
      res.send(pdfData);
    });

    // 绘制 PDF 内容
    const pageWidth = doc.page.width - 100;
    doc.font('CNBold').fontSize(18).text('党政软件版本管控平台', { align: 'center' });
    doc.font('CNRegular').fontSize(14).text('审计报表', { align: 'center' });
    doc.moveDown(1);

    const fmtTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-';
    doc.font('CNRegular').fontSize(11);
    const drawKV = (k, v) => { doc.font('CNBold').text(k, 50, doc.y, { width: 100 }); doc.font('CNRegular').text(String(v), 150, doc.y - doc.currentLineHeight(), { width: 400 }); doc.moveDown(0.4); };
    drawKV('报表名称:', report.name || '-');
    drawKV('生成时间:', fmtTime(report.created_at));
    drawKV('数据条数:', auditLogs.length + ' 条');

    // 操作类型分布
    const typeCount = {};
    for (const log of auditLogs) {
      const name = actionNames[log.action_type] || log.action_type || '其他';
      typeCount[name] = (typeCount[name] || 0) + 1;
    }
    if (Object.keys(typeCount).length > 0) {
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(pageWidth + 50, doc.y).stroke('#cccccc');
      doc.moveDown(0.3);
      doc.font('CNBold').text('操作类型分布:');
      doc.font('CNRegular');
      for (const [k, v] of Object.entries(typeCount)) {
        doc.text(`  ${k}: ${v} 次`, 50, doc.y, { width: 450 });
        doc.moveDown(0.2);
      }
    }

    // 详细日志列表
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(pageWidth + 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);
    doc.font('CNBold').text(`详细日志列表（共 ${auditLogs.length} 条）:`);
    doc.moveDown(0.3);

    doc.font('CNRegular').fontSize(8);
    for (const log of auditLogs) {
      const line = `[${fmtTime(log.timestamp)}] ${log.username || '-'} ${actionNames[log.action_type] || log.action_type || ''} ${log.action_name || ''} ${log.request_ip || ''}`;
      doc.text(line, 50, doc.y, { width: pageWidth, lineBreak: true });
      doc.moveDown(0.15);
      // 分页
      if (doc.y > 720) { doc.addPage(); }
    }

    // 页脚
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(pageWidth + 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);
    doc.font('CNRegular').fontSize(9).fillColor('#999999').text('党政软件版本管控平台 © 2026', { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
