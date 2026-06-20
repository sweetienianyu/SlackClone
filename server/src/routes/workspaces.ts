import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 获取用户的工作区列表（按最近加入排序）
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.userId! },
      include: { workspace: true },
      orderBy: { joinedAt: 'desc' },
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
      include: { user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, status: true } } },
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

// ============ 管理后台 API ============

// 管理员权限校验中间件
const requireAdmin = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.userId!, workspaceId: req.params.id } },
    });
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可访问' });
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 工作区统计数据
router.get('/:id/admin/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.params.id;

    const [memberCount, channelCount, messageCount, docCount] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.channel.count({ where: { workspaceId } }),
      prisma.message.count({ where: { channel: { workspaceId } } }),
      prisma.document.count({ where: { workspaceId } }),
    ]);

    // 文件消息数（type=file）
    const fileCount = await prisma.message.count({
      where: { channel: { workspaceId }, type: 'file' },
    });

    // 最近 7 天每日消息量
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentMessages = await prisma.message.findMany({
      where: { channel: { workspaceId }, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });

    const dailyStats: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyStats[key] = 0;
    }
    recentMessages.forEach((m) => {
      const key = m.createdAt.toISOString().slice(0, 10);
      if (dailyStats[key] !== undefined) dailyStats[key]++;
    });

    // 活跃成员（最近 7 天发过消息）
    const activeMemberIds = new Set(
      (await prisma.message.findMany({
        where: { channel: { workspaceId }, createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      })).map((m) => m.userId)
    );

    // 频道活跃度排行（最近 7 天消息数）
    const channelActivity = await prisma.channel.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { members: true } },
      },
    });
    const channelStats = await Promise.all(
      channelActivity.map(async (ch) => {
        const msgCount = await prisma.message.count({
          where: { channelId: ch.id, createdAt: { gte: sevenDaysAgo } },
        });
        return {
          id: ch.id,
          name: ch.name,
          type: ch.type,
          memberCount: ch._count.members,
          messageCount: msgCount,
        };
      })
    );
    channelStats.sort((a, b) => b.messageCount - a.messageCount);

    // 存储用量（文件消息的 fileSize 总和）
    const fileMessages = await prisma.message.findMany({
      where: { channel: { workspaceId }, type: 'file' },
      select: { fileSize: true },
    });
    const totalStorage = fileMessages.reduce((sum: number, f: any) => sum + (f.fileSize || 0), 0);

    res.json({
      members: { total: memberCount, active: activeMemberIds.size },
      channels: { total: channelCount },
      messages: { total: messageCount, last7Days: recentMessages.length },
      files: { total: fileCount, storageBytes: totalStorage },
      documents: { total: docCount },
      dailyMessageStats: Object.entries(dailyStats).map(([date, count]) => ({ date, count })),
      topChannels: channelStats.slice(0, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 成员管理（含角色）
router.get('/:id/admin/members', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.params.id },
      include: {
        user: {
          select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
    });

    // 统计每个成员的消息数
    const memberStats = await Promise.all(
      members.map(async (m) => {
        const msgCount = await prisma.message.count({
          where: { userId: m.userId, channel: { workspaceId: req.params.id } },
        });
        return { ...m, messageCount: msgCount };
      })
    );

    res.json(memberStats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新成员角色（仅管理员）
router.put('/:id/admin/members/:userId/role', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: '角色只能是 admin 或 member' });
    }

    const target = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } },
    });
    if (!target) return res.status(404).json({ error: '成员不存在' });

    // 防止最后一个管理员降级
    if (target.role === 'admin' && role === 'member') {
      const adminCount = await prisma.workspaceMember.count({
        where: { workspaceId: req.params.id, role: 'admin' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '不能降级最后一个管理员' });
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } },
      data: { role },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 频道管理列表
router.get('/:id/admin/channels', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await prisma.channel.findMany({
      where: { workspaceId: req.params.id },
      include: {
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除频道（管理员）
router.delete('/:id/admin/channels/:channelId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.channel.delete({ where: { id: req.params.channelId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
