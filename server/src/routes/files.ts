import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 允许的文件类型
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.csv'];

// 文件上传配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext || file.mimetype}。支持: jpg/png/gif/webp/pdf/doc/docx/txt/csv`));
    }
  },
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
        content: req.body.content || `📎 ${file.originalname}`,
        type: 'file',
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true } } } },
      },
    });

    const io = req.app.get('io');
    if (io) io.to(channelId).emit('message:new', message);

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取频道文件列表（支持按类型/上传者筛选）
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const channelId = req.query.channel_id as string;
    const fileType = req.query.type as string; // image, pdf, document, all
    const uploaderId = req.query.uploader_id as string;

    if (!channelId) return res.status(400).json({ error: 'channel_id 必填' });

    const where: any = { channelId, type: 'file' };

    if (uploaderId) where.userId = uploaderId;

    if (fileType && fileType !== 'all') {
      switch (fileType) {
        case 'image':
          where.fileType = { in: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] };
          break;
        case 'pdf':
          where.fileType = 'application/pdf';
          break;
        case 'document':
          where.fileType = { in: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'] };
          break;
      }
    }

    const files = await prisma.message.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 文件搜索（按名称搜索）
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    const workspaceId = req.query.workspace_id as string;
    if (!q) return res.status(400).json({ error: '搜索关键词必填' });

    // 获取用户所在工作区的频道
    const channels = await prisma.channel.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const channelIds = channels.map((c) => c.id);

    const files = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        type: 'file',
        fileName: { contains: q },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 下载文件
router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || !message.fileUrl) return res.status(404).json({ error: '文件不存在' });

    const filePath = path.join(__dirname, '../../uploads', path.basename(message.fileUrl));
    res.download(filePath, message.fileName || path.basename(message.fileUrl));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
