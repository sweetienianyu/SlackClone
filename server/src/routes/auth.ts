import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../config/jwt';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, username, displayName, password } = req.body;
    if (!email || !username || !displayName || !password) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return res.status(409).json({ error: '邮箱或用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, displayName, password: hashedPassword },
    });

    const token = generateToken({ userId: user.id });
    res.status(201).json({
      token,
      refreshToken: token,
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '注册失败' });
  }
});

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码都是必填的' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = generateToken({ userId: user.id });
    res.json({
      token,
      refreshToken: token,
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '登录失败' });
  }
});

// 获取当前用户
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status, createdAt: user.createdAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '获取用户信息失败' });
  }
});

// 更新个人资料
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, username, status, avatarUrl } = req.body;

    const data: any = {};
    if (displayName !== undefined) data.displayName = displayName;
    if (username !== undefined) {
      const existing = await prisma.user.findFirst({ where: { username, id: { not: req.userId! } } });
      if (existing) return res.status(409).json({ error: '用户名已被占用' });
      data.username = username;
    }
    if (status !== undefined) data.status = status;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data,
    });

    res.json({
      id: user.id, email: user.email, username: user.username,
      displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '更新失败' });
  }
});

export default router;
