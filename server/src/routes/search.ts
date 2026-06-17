import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 搜索消息：支持全文模糊匹配 + 按频道/时间/作者/类型筛选
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) return res.status(400).json({ error: '搜索关键词必填' });

    // 筛选参数
    const channelId = req.query.channel_id as string | undefined;
    const userId = req.query.user_id as string | undefined;
    const type = req.query.type as string | undefined; // text, file, system
    const fromDate = req.query.from as string | undefined;
    const toDate = req.query.to as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // 获取用户可见的频道（公开频道 + 已加入的私有频道）
    const workspaceId = req.query.workspace_id as string | undefined;
    const visibleChannels = await prisma.channel.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        OR: [
          { type: 'public' },
          { members: { some: { userId: req.userId! } } },
        ],
      },
      select: { id: true },
    });
    const visibleChannelIds = visibleChannels.map((c) => c.id);

    // 构建查询条件
    const where: Prisma.MessageWhereInput = {
      content: { contains: q },
      channelId: { in: channelId ? [channelId] : visibleChannelIds },
    };

    if (userId) where.userId = userId;
    if (type) where.type = type;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true, type: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
