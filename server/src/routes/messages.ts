import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 聚合 reactions 为 { emoji, userIds } 格式
function formatReactions(reactions: any[]) {
  const reactionMap = new Map<string, string[]>();
  for (const r of reactions) {
    const list = reactionMap.get(r.emoji) || [];
    list.push(r.userId);
    reactionMap.set(r.emoji, list);
  }
  return Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({ emoji, userIds }));
}

// 获取频道消息
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const channelId = req.query.channel_id as string;
    if (!channelId) return res.status(400).json({ error: 'channel_id 必填' });

    const cursor = req.query.cursor as string | undefined;
    const limit = 50;

    const messages = await prisma.message.findMany({
      where: { channelId, parentId: null },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true, displayName: true } } } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const formatted = messages.reverse().map((msg: any) => ({
      ...msg,
      reactions: formatReactions(msg.reactions),
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 发送消息
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId, content, parentId } = req.body;
    if (!channelId || !content) return res.status(400).json({ error: 'channelId 和 content 必填' });

    const message = await prisma.message.create({
      data: { channelId, userId: req.userId!, content, parentId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true } } } },
      },
    });

    const formattedMessage = {
      ...message,
      reactions: formatReactions(message.reactions),
    };

    // 通过 Socket.IO 广播
    const io = req.app.get('io');
    if (io) {
      io.to(channelId).emit('message:new', formattedMessage);

      // 如果是线程回复，额外广播线程事件
      if (parentId) {
        io.to(channelId).emit('thread:reply', { parentId, reply: formattedMessage });
      }

      // 解析 @提及 并通知被提及的用户
      const mentionRegex = /@(\w+)/g;
      let match;
      const mentionedUsernames = new Set<string>();
      while ((match = mentionRegex.exec(content)) !== null) {
        mentionedUsernames.add(match[1]);
      }

      if (mentionedUsernames.size > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: Array.from(mentionedUsernames) } },
          select: { id: true },
        });

        const channel = await prisma.channel.findUnique({ where: { id: channelId } });

        for (const mu of mentionedUsers) {
          if (mu.id !== req.userId) {
            io.to(mu.id).emit('notification:mention', {
              messageId: message.id,
              channelId,
              channelName: channel?.name,
              fromUser: message.user?.displayName,
              content: content.slice(0, 100),
              createdAt: message.createdAt,
            });
          }
        }
      }
    }

    res.status(201).json(formattedMessage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 编辑消息
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const existing = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '消息不存在' });
    if (existing.userId !== req.userId) return res.status(403).json({ error: '无权编辑' });

    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: { content, editedAt: new Date() },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true } } } },
      },
    });

    const formattedMessage = {
      ...message,
      reactions: formatReactions(message.reactions),
    };

    const io = req.app.get('io');
    if (io) io.to(message.channelId).emit('message:update', formattedMessage);

    res.json(formattedMessage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除消息
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '消息不存在' });
    if (existing.userId !== req.userId) return res.status(403).json({ error: '无权删除' });

    await prisma.message.delete({ where: { id: req.params.id } });

    const io = req.app.get('io');
    if (io) io.to(existing.channelId).emit('message:delete', { id: req.params.id });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 添加/切换反应
router.post('/:id/reactions', async (req: AuthRequest, res: Response) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji 必填' });

    // 检查是否已存在
    const existing = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: req.params.id,
          userId: req.userId!,
          emoji,
        },
      },
    });

    if (existing) {
      // 已存在则删除（取消点赞）
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      // 不存在则创建
      await prisma.reaction.create({
        data: { messageId: req.params.id, userId: req.userId!, emoji },
      });
    }

    // 返回更新后的消息（含聚合 reactions）
    const updatedMessage = await prisma.message.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true } } } },
      },
    });

    const formattedMessage = {
      ...updatedMessage,
      reactions: formatReactions(updatedMessage?.reactions || []),
    };

    const io = req.app.get('io');
    if (io && updatedMessage) io.to(updatedMessage.channelId).emit('message:update', formattedMessage);

    res.status(201).json(formattedMessage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取线程消息
router.get('/:id/thread', async (req: AuthRequest, res: Response) => {
  try {
    const replies = await prisma.message.findMany({
      where: { parentId: req.params.id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = replies.map((msg: any) => ({
      ...msg,
      reactions: formatReactions(msg.reactions),
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
