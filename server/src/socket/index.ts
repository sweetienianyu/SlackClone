import { Server } from 'socket.io';
import { verifyToken } from '../config/jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173', credentials: true },
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

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.displayName} disconnected`);
      prisma.user.update({
        where: { id: user.id },
        data: { status: 'offline' },
      }).catch(console.error);
    });
  });

  return io;
}
