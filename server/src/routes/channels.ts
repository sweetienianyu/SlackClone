import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 获取频道列表
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspace_id as string;
    if (!workspaceId) return res.status(400).json({ error: 'workspace_id 必填' });

    // 获取用户在该工作区的频道
    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
        OR: [
          { type: 'public' },
          { members: { some: { userId: req.userId! } } },
        ],
      },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId: { not: req.userId! } },
          include: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 为 DM 频道添加 displayName
    const result = channels.map((ch) => ({
      ...ch,
      displayName: ch.type === 'dm' && ch.members.length > 0
        ? ch.members[0].user?.displayName || ch.members[0].user?.username || ch.name
        : ch.name,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建频道
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, name, type = 'public', topic } = req.body;
    if (!workspaceId || !name) return res.status(400).json({ error: 'workspaceId 和 name 必填' });

    const existing = await prisma.channel.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
    if (existing) return res.status(409).json({ error: '频道名已存在' });

    const channel = await prisma.channel.create({
      data: {
        workspaceId,
        name: name.toLowerCase().replace(/\s+/g, '-'),
        type,
        topic,
        createdBy: req.userId!,
        members: { create: { userId: req.userId!, role: 'admin' } },
      },
    });
    res.status(201).json(channel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取频道详情
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) return res.status(404).json({ error: '频道不存在' });
    res.json(channel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 加入频道
router.post('/:id/join', async (req: AuthRequest, res: Response) => {
  try {
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) return res.status(404).json({ error: '频道不存在' });
    if (channel.type === 'private') return res.status(403).json({ error: '无法直接加入私有频道，需要邀请' });

    const existing = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    if (existing) return res.status(409).json({ error: '已在该频道' });

    const member = await prisma.channelMember.create({
      data: { channelId: req.params.id, userId: req.userId! },
    });
    res.status(201).json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建或获取 DM 频道
router.post('/dm', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, targetUserId } = req.body;
    if (!workspaceId || !targetUserId) return res.status(400).json({ error: 'workspaceId 和 targetUserId 必填' });

    // 查找已有的 DM 频道
    const existingDm = await prisma.channel.findFirst({
      where: {
        workspaceId,
        type: 'dm',
        members: { every: { userId: { in: [req.userId!, targetUserId] } } },
      },
      include: { members: true },
    });

    if (existingDm && existingDm.members.length === 2) {
      return res.json(existingDm);
    }

    // 创建新 DM 频道
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) return res.status(404).json({ error: '目标用户不存在' });

    const dmChannel = await prisma.channel.create({
      data: {
        workspaceId,
        name: `dm-${req.userId!}-${targetUserId}`,
        type: 'dm',
        createdBy: req.userId!,
        members: {
          create: [
            { userId: req.userId!, role: 'member' },
            { userId: targetUserId, role: 'member' },
          ],
        },
      },
      include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } } } },
    });

    res.status(201).json(dmChannel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 邀请用户加入私有频道
router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { userId: targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'userId 必填' });

    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) return res.status(404).json({ error: '频道不存在' });

    const existing = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: targetUserId } },
    });
    if (existing) return res.status(409).json({ error: '用户已在该频道' });

    const member = await prisma.channelMember.create({
      data: { channelId: req.params.id, userId: targetUserId },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    });

    const io = req.app.get('io');
    if (io) io.to(targetUserId).emit('channel:invited', channel);

    res.status(201).json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取频道成员列表
router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.channelMember.findMany({
      where: { channelId: req.params.id },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } },
    });
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
