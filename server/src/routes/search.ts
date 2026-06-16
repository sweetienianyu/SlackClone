import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: '搜索关键词必填' });

    // 获取用户所在工作区的频道
    const memberships = await prisma.channelMember.findMany({
      where: { userId: req.userId! },
      select: { channelId: true },
    });
    const channelIds = memberships.map((m) => m.channelId);

    const messages = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        content: { contains: q },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
