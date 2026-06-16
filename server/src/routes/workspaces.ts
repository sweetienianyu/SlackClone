import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 获取用户的工作区列表
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.userId! },
      include: { workspace: true },
    });
    res.json(memberships.map((m) => m.workspace));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建工作区
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '工作区名称必填' });

    // 生成邀请码
    const inviteCode = Math.random().toString(36).slice(2, 10);

    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerId: req.userId!,
        inviteCode,
        members: {
          create: { userId: req.userId!, role: 'admin' },
        },
      },
    });

    // 自动创建 #general 频道
    await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        name: 'general',
        type: 'public',
        createdBy: req.userId!,
        members: { create: { userId: req.userId!, role: 'admin' } },
      },
    });

    res.status(201).json(workspace);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 通过邀请码加入工作区
router.post('/join', async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: '邀请码必填' });

    const workspace = await prisma.workspace.findUnique({ where: { inviteCode } });
    if (!workspace) return res.status(404).json({ error: '邀请码无效' });

    const existing = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.userId!, workspaceId: workspace.id } },
    });
    if (existing) return res.status(409).json({ error: '你已在该工作区' });

    // 加入工作区
    await prisma.workspaceMember.create({
      data: { userId: req.userId!, workspaceId: workspace.id, role: 'member' },
    });

    // 自动加入所有公开频道
    const publicChannels = await prisma.channel.findMany({
      where: { workspaceId: workspace.id, type: 'public' },
    });
    for (const ch of publicChannels) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: req.userId! } },
        create: { channelId: ch.id, userId: req.userId!, role: 'member' },
        update: {},
      });
    }

    res.json(workspace);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取工作区邀请码（仅管理员）
router.get('/:id/invite-code', async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.userId!, workspaceId: req.params.id } },
    });
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可查看邀请码' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: req.params.id } });
    if (!workspace) return res.status(404).json({ error: '工作区不存在' });

    res.json({ inviteCode: workspace.inviteCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 重新生成邀请码（仅管理员）
router.post('/:id/regenerate-invite', async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.userId!, workspaceId: req.params.id } },
    });
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可重新生成邀请码' });
    }

    const inviteCode = Math.random().toString(36).slice(2, 10);
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: { inviteCode },
    });

    res.json({ inviteCode: workspace.inviteCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取工作区成员
router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.params.id },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } },
    });
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 邀请成员
router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email 必填' });

    // 验证邀请者是工作区成员
    const inviter = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.userId!, workspaceId: req.params.id } },
    });
    if (!inviter) return res.status(403).json({ error: '你不是该工作区成员，无权邀请' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const existing = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: req.params.id } },
    });
    if (existing) return res.status(409).json({ error: '用户已在该工作区' });

    // 加入工作区
    const member = await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId: req.params.id },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    });

    // 自动加入该工作区所有公开频道
    const publicChannels = await prisma.channel.findMany({
      where: { workspaceId: req.params.id, type: 'public' },
    });
    for (const ch of publicChannels) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: user.id } },
        create: { channelId: ch.id, userId: user.id, role: 'member' },
        update: {},
      });
    }

    // 通过 WebSocket 通知被邀请用户
    const io = req.app.get('io');
    if (io) io.to(user.id).emit('workspace:invited', { workspaceId: req.params.id });

    res.status(201).json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 移除工作区成员（仅管理员）
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    // 验证操作者是管理员
    const operator = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.userId!, workspaceId: req.params.id } },
    });
    if (!operator || operator.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可移除成员' });
    }

    // 不能移除自己
    if (req.params.userId === req.userId) {
      return res.status(400).json({ error: '不能移除自己' });
    }

    // 不能移除管理员
    const target = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } },
    });
    if (!target) return res.status(404).json({ error: '该用户不在此工作区' });
    if (target.role === 'admin') return res.status(403).json({ error: '不能移除管理员' });

    await prisma.workspaceMember.delete({
      where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } },
    });

    // 同时移除该用户在所有频道的成员关系
    await prisma.channelMember.deleteMany({
      where: { userId: req.params.userId, channel: { workspaceId: req.params.id } },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
