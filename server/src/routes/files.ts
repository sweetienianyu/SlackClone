import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 文件上传配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// 上传文件并发送文件消息
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const channelId = req.body.channelId;
    if (!file || !channelId) return res.status(400).json({ error: '文件和频道ID必填' });

    const fileUrl = `/uploads/${file.filename}`;
    const message = await prisma.message.create({
      data: {
        channelId,
        userId: req.userId!,
        content: req.body.content || `文件: ${file.originalname}`,
        type: 'file',
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: true,
      },
    });

    const io = req.app.get('io');
    if (io) io.to(channelId).emit('message:new', message);

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取频道文件列表
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const channelId = req.query.channel_id as string;
    if (!channelId) return res.status(400).json({ error: 'channel_id 必填' });

    const files = await prisma.message.findMany({
      where: { channelId, type: 'file' },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
