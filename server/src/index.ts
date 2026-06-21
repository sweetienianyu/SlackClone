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
import documentRoutes from './routes/documents';
import { authMiddleware } from './middleware/auth';

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174'];

// 中间件
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    // 生产环境前后端同域，允许无 origin 的请求（如服务端请求）
    if (!origin || CORS_ORIGINS.includes(origin) || CORS_ORIGINS.length === 0) {
      callback(null, true);
    } else {
      callback(null, true); // 开发模式也放行
    }
  },
  credentials: true,
}));
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
app.use('/api/documents', authMiddleware, documentRoutes);

// WebSocket
const io = setupSocketIO(server);
app.set('io', io);

// 生产环境：托管客户端静态文件
const clientDistPath = path.join(__dirname, '../../client/dist');
if (require('fs').existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA 路由回退
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log(`[Server] Serving client from ${clientDistPath}`);
}

// 启动
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

export { prisma, io };
