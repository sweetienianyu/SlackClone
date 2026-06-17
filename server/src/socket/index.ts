import { Server } from 'socket.io';
import { verifyToken } from '../config/jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true },
  });

  // 认证中间件
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未认证'));

    const payload = verifyToken(token);
    if (!payload) return next(new Error('令牌无效'));

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return next(new Error('用户不存在'));

    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[Socket] ${user.displayName} connected (${socket.id})`);

    // 加入用户个人房间（用于 @提及通知等定向推送）
    socket.join(user.id);

    // 更新用户状态为在线
    prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    }).catch(console.error);

    // 广播用户上线状态
    io.emit('user:status', { userId: user.id, status: 'online' });

    // 加入频道房间
    socket.on('channel:join', (channelId: string) => {
      socket.join(channelId);
      console.log(`[Socket] ${user.displayName} joined channel ${channelId}`);
    });

    // 离开频道房间
    socket.on('channel:leave', (channelId: string) => {
      socket.leave(channelId);
    });

    // 打字指示器
    socket.on('user:typing', ({ channelId, isTyping }: { channelId: string; isTyping: boolean }) => {
      socket.to(channelId).emit('user:typing', {
        userId: user.id,
        channelId,
        isTyping,
        username: user.displayName,
      });
    });

    // 线程打开/关闭 - 广播给同频道其他用户
    socket.on('thread:open', ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      socket.to(channelId).emit('thread:open', { messageId, fromUser: { id: user.id, displayName: user.displayName } });
    });

    socket.on('thread:close', () => {
      socket.broadcast.emit('thread:close');
    });

    // 文档协作 - 加入/离开文档房间
    socket.on('document:join', (docId: string) => {
      socket.join(`doc:${docId}`);
      socket.to(`doc:${docId}`).emit('document:user-joined', { userId: user.id, displayName: user.displayName });
    });

    socket.on('document:leave', (docId: string) => {
      socket.leave(`doc:${docId}`);
      socket.to(`doc:${docId}`).emit('document:user-left', { userId: user.id });
    });

    // 文档实时编辑（增量同步，简化版：广播光标和内容变更）
    socket.on('document:cursor', ({ docId, position }: { docId: string; position: number }) => {
      socket.to(`doc:${docId}`).emit('document:cursor', { userId: user.id, displayName: user.displayName, position });
    });

    socket.on('document:edit', ({ docId, content, title }: { docId: string; content?: string; title?: string }) => {
      socket.to(`doc:${docId}`).emit('document:edit', { content, title, fromUser: { id: user.id, displayName: user.displayName } });
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.displayName} disconnected`);
      prisma.user.update({
        where: { id: user.id },
        data: { status: 'offline' },
      }).catch(console.error);
      // 广播用户离线状态
      io.emit('user:status', { userId: user.id, status: 'offline' });
    });
  });

  return io;
}
