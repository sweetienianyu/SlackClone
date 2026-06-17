import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 获取频道列表（含分组、置顶信息）
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspace_id as string;
    if (!workspaceId) return res.status(400).json({ error: 'workspace_id 必填' });

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
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 获取当前用户的置顶频道、通知偏好、静音状态
    const myMemberships = await prisma.channelMember.findMany({
      where: { userId: req.userId!, channel: { workspaceId } },
      select: { channelId: true, pinned: true, notifyPreference: true, muted: true, mutedUntil: true },
    });
    const memberMap = new Map(myMemberships.map((m) => [m.channelId, m]));

    const result = channels.map((ch) => {
      const m = memberMap.get(ch.id);
      const isMuted = m?.muted && (!m.mutedUntil || new Date(m.mutedUntil) > new Date());
      return {
        ...ch,
        displayName: ch.type === 'dm' && ch.members.length > 0
          ? ch.members[0].user?.displayName || ch.members[0].user?.username || ch.name
          : ch.name,
        pinned: m?.pinned || false,
        notifyPreference: m?.notifyPreference || 'all',
        muted: isMuted || false,
        mutedUntil: m?.mutedUntil || null,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建频道
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, name, type = 'public', topic, groupId } = req.body;
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
        groupId: groupId || null,
        createdBy: req.userId!,
        members: { create: { userId: req.userId!, role: 'admin' } },
      },
    });
    res.status(201).json(channel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新频道信息（topic, description, name, groupId）
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, topic, description, groupId } = req.body;
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) return res.status(404).json({ error: '频道不存在' });

    // 检查是否是频道管理员或工作区管理员
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    if (!member || (member.role !== 'admin')) {
      return res.status(403).json({ error: '仅频道管理员可编辑' });
    }

    const updated = await prisma.channel.update({
      where: { id: req.params.id },
      data: {
        ...(name ? { name: name.toLowerCase().replace(/\s+/g, '-') } : {}),
        ...(topic !== undefined ? { topic } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(groupId !== undefined ? { groupId: groupId || null } : {}),
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取频道详情（含成员、置顶消息）
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } },
        },
        group: { select: { id: true, name: true } },
        pinnedMessages: {
          include: { message: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
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

// 离开频道
router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    if (!member) return res.status(404).json({ error: '不在该频道' });
    await prisma.channelMember.delete({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 置顶/取消置顶频道
router.post('/:id/pin', async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    if (!member) return res.status(404).json({ error: '不在该频道' });

    // 检查置顶数量上限
    if (!member.pinned) {
      const pinnedCount = await prisma.channelMember.count({
        where: { userId: req.userId!, pinned: true, channel: { workspaceId: (await prisma.channel.findUnique({ where: { id: req.params.id } }))!.workspaceId } },
      });
      if (pinnedCount >= 10) return res.status(400).json({ error: '最多置顶 10 个频道' });
    }

    const updated = await prisma.channelMember.update({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
      data: { pinned: !member.pinned },
    });
    res.json({ pinned: updated.pinned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 置顶消息
router.post('/:id/pin-message', async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId 必填' });

    const existing = await prisma.pinnedMessage.findUnique({
      where: { channelId_messageId: { channelId: req.params.id, messageId } },
    });
    if (existing) {
      await prisma.pinnedMessage.delete({ where: { id: existing.id } });
      res.json({ pinned: false });
    } else {
      await prisma.pinnedMessage.create({
        data: { channelId: req.params.id, messageId, pinnedBy: req.userId! },
      });
      res.json({ pinned: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取频道置顶消息
router.get('/:id/pinned', async (req: AuthRequest, res: Response) => {
  try {
    const pinned = await prisma.pinnedMessage.findMany({
      where: { channelId: req.params.id },
      include: { message: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pinned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建或获取 DM 频道
router.post('/dm', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, targetUserId } = req.body;
    if (!workspaceId || !targetUserId) return res.status(400).json({ error: 'workspaceId 和 targetUserId 必填' });

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

// ============ 频道分组 ============

// 获取工作区分组列表
router.get('/groups/list', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspace_id as string;
    if (!workspaceId) return res.status(400).json({ error: 'workspace_id 必填' });

    const groups = await prisma.channelGroup.findMany({
      where: { workspaceId },
      include: { channels: { select: { id: true, name: true } } },
      orderBy: { sort: 'asc' },
    });
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建分组
router.post('/groups', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, name, sort } = req.body;
    if (!workspaceId || !name) return res.status(400).json({ error: 'workspaceId 和 name 必填' });

    const group = await prisma.channelGroup.create({
      data: { workspaceId, name, sort: sort || 0 },
    });
    res.status(201).json(group);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新分组
router.put('/groups/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, sort } = req.body;
    const group = await prisma.channelGroup.update({
      where: { id: req.params.id },
      data: { ...(name ? { name } : {}), ...(sort !== undefined ? { sort } : {}) },
    });
    res.json(group);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除分组
router.delete('/groups/:id', async (req: AuthRequest, res: Response) => {
  try {
    // 将分组下的频道 groupId 设为 null
    await prisma.channel.updateMany({
      where: { groupId: req.params.id },
      data: { groupId: null },
    });
    await prisma.channelGroup.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 通知偏好设置（all / mentions / none）
router.put('/:id/notification-preference', async (req: AuthRequest, res: Response) => {
  try {
    const { preference } = req.body;
    if (!['all', 'mentions', 'none'].includes(preference)) {
      return res.status(400).json({ error: 'preference 必须为 all/mentions/none' });
    }
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    if (!member) return res.status(404).json({ error: '不在该频道' });

    const updated = await prisma.channelMember.update({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
      data: { notifyPreference: preference },
    });
    res.json({ notifyPreference: updated.notifyPreference });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 频道静音（1小时 / 直到明天 / 取消静音）
router.post('/:id/mute', async (req: AuthRequest, res: Response) => {
  try {
    const { duration } = req.body; // '1h' | 'until_tomorrow' | 'off'
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
    });
    if (!member) return res.status(404).json({ error: '不在该频道' });

    let mutedUntil: Date | null = null;
    const now = new Date();
    if (duration === '1h') {
      mutedUntil = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (duration === 'until_tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0); // 明天早 8 点
      mutedUntil = tomorrow;
    }

    const updated = await prisma.channelMember.update({
      where: { channelId_userId: { channelId: req.params.id, userId: req.userId! } },
      data: { muted: duration !== 'off', mutedUntil },
    });
    res.json({ muted: updated.muted, mutedUntil: updated.mutedUntil });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
