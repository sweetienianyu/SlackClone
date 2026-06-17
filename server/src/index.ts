import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { setupSocketIO } from './socket';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import searchRoutes from './routes/search';
import fileRoutes from './routes/files';
import { authMiddleware } from './middleware/auth';

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json());

// 静态文件服务 - 上传的文件
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 公开路由
app.use('/api/auth', authRoutes);

// 受保护路由
app.use('/api/workspaces', authMiddleware, workspaceRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/search', authMiddleware, searchRoutes);
app.use('/api/files', authMiddleware, fileRoutes);

// WebSocket
const io = setupSocketIO(server);
app.set('io', io);

// 启动
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

export { prisma, io };
