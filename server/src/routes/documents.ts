import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 文档模板预设
const TEMPLATES: Record<string, { title: string; content: string }> = {
  blank: { title: '无标题文档', content: '' },
  meeting: {
    title: '会议纪要',
    content: '# 会议纪要\n\n**日期：** \n**参会人：** \n\n## 议题\n1. \n2. \n\n## 讨论内容\n\n\n## 决议\n- \n\n## 待办事项\n- [ ] \n',
  },
  plan: {
    title: '项目计划',
    content: '# 项目计划\n\n**项目名称：** \n**负责人：** \n**周期：** \n\n## 目标\n- \n\n## 里程碑\n| 阶段 | 时间 | 交付物 |\n|------|------|--------|\n| 1 | | |\n| 2 | | |\n\n## 风险\n- \n',
  },
  retro: {
    title: '回顾总结',
    content: '# 回顾总结\n\n**周期：** \n\n## 做得好的\n- \n\n## 需要改进的\n- \n\n## 下一步行动\n- [ ] \n',
  },
};

// 获取文档列表
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspace_id as string;
    const channelId = req.query.channel_id as string | undefined;
    if (!workspaceId) return res.status(400).json({ error: 'workspace_id 必填' });

    const docs = await prisma.document.findMany({
      where: { workspaceId, ...(channelId ? { channelId } : {}) },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个文档
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
    });
    if (!doc) return res.status(404).json({ error: '文档不存在' });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建文档
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, title, content, template, channelId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId 必填' });

    const tpl = template && TEMPLATES[template] ? TEMPLATES[template] : TEMPLATES.blank;

    const doc = await prisma.document.create({
      data: {
        workspaceId,
        channelId: channelId || null,
        title: title || tpl.title,
        content: content !== undefined ? content : tpl.content,
        template: template || 'blank',
        createdBy: req.userId!,
      },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新文档（支持部分更新）
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;

    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data,
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    // 通过 Socket 广播文档更新（实时协作）
    const io = req.app.get('io');
    if (io) {
      io.to(`doc:${doc.id}`).emit('document:update', { id: doc.id, title: doc.title, content: doc.content });
    }

    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除文档
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取模板列表
router.get('/templates/list', async (_req: AuthRequest, res: Response) => {
  res.json(Object.entries(TEMPLATES).map(([key, val]) => ({
    key,
    title: val.title,
    preview: val.content.slice(0, 200),
  })));
});

export default router;
