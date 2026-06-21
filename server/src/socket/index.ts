import { Server } from 'socket.io';
import { verifyToken } from '../config/jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 活跃通话状态（内存存储）
interface ActiveCall {
  callId: string;
  channelId: string;
  createdBy: string;
  participants: Map<string, { socketId: string; displayName: string; avatarUrl: string | null; handRaised: boolean }>;
  startedAt: Date;
}
const activeCalls = new Map<string, ActiveCall>(); // channelId -> ActiveCall

export function setupSocketIO(httpServer: any) {
  const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174'];
  const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : true, credentials: true },
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

    // ============ Huddles 音视频通话信令 ============

    // 发起通话
    socket.on('huddle:start', ({ channelId }: { channelId: string }) => {
      const callId = `huddle-${channelId}-${Date.now()}`;
      const call: ActiveCall = {
        callId,
        channelId,
        createdBy: user.id,
        participants: new Map(),
        startedAt: new Date(),
      };
      call.participants.set(user.id, {
        socketId: socket.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        handRaised: false,
      });
      activeCalls.set(channelId, call);

      // 通知频道内其他人有新通话
      socket.to(channelId).emit('huddle:incoming', {
        callId,
        channelId,
        from: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
      });

      // 回复发起者通话已创建
      socket.emit('huddle:started', { callId, channelId });
    });

    // 加入通话
    socket.on('huddle:join', ({ channelId }: { channelId: string }) => {
      const call = activeCalls.get(channelId);
      if (!call) return socket.emit('huddle:error', { message: '通话不存在或已结束' });

      call.participants.set(user.id, {
        socketId: socket.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        handRaised: false,
      });

      // 加入通话房间
      socket.join(`huddle:${channelId}`);

      // 通知通话中其他人有新参与者
      socket.to(`huddle:${channelId}`).emit('huddle:participant-joined', {
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      });

      // 回复加入者当前参与者列表
      const participants = Array.from(call.participants.entries()).map(([id, p]) => ({
        userId: id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        handRaised: p.handRaised,
      }));
      socket.emit('huddle:participants', { participants });

      // 向加入者发送每个已有参与者的 WebRTC offer
      // （已有参与者会收到通知并发起 offer）
    });

    // WebRTC 信令：Offer
    socket.on('huddle:offer', ({ channelId, targetUserId, offer }: { channelId: string; targetUserId: string; offer: any }) => {
      const call = activeCalls.get(channelId);
      if (!call) return;
      const target = call.participants.get(targetUserId);
      if (!target) return;

      io.to(target.socketId).emit('huddle:offer', {
        fromUserId: user.id,
        fromDisplayName: user.displayName,
        offer,
      });
    });

    // WebRTC 信令：Answer
    socket.on('huddle:answer', ({ channelId, targetUserId, answer }: { channelId: string; targetUserId: string; answer: any }) => {
      const call = activeCalls.get(channelId);
      if (!call) return;
      const target = call.participants.get(targetUserId);
      if (!target) return;

      io.to(target.socketId).emit('huddle:answer', {
        fromUserId: user.id,
        answer,
      });
    });

    // WebRTC 信令：ICE Candidate
    socket.on('huddle:ice-candidate', ({ channelId, targetUserId, candidate }: { channelId: string; targetUserId: string; candidate: any }) => {
      const call = activeCalls.get(channelId);
      if (!call) return;
      const target = call.participants.get(targetUserId);
      if (!target) return;

      io.to(target.socketId).emit('huddle:ice-candidate', {
        fromUserId: user.id,
        candidate,
      });
    });

    // 离开通话
    socket.on('huddle:leave', ({ channelId }: { channelId: string }) => {
      const call = activeCalls.get(channelId);
      if (!call) return;

      call.participants.delete(user.id);
      socket.leave(`huddle:${channelId}`);

      // 通知其他人
      socket.to(`huddle:${channelId}`).emit('huddle:participant-left', { userId: user.id, displayName: user.displayName });

      // 如果没有人了，结束通话
      if (call.participants.size === 0) {
        activeCalls.delete(channelId);
        io.to(channelId).emit('huddle:ended', { channelId });
      }
    });

    // 结束通话（发起者）
    socket.on('huddle:end', ({ channelId }: { channelId: string }) => {
      const call = activeCalls.get(channelId);
      if (!call || call.createdBy !== user.id) return;

      activeCalls.delete(channelId);
      io.to(`huddle:${channelId}`).emit('huddle:ended', { channelId });
      // 通知频道内所有人通话已结束
      io.to(channelId).emit('huddle:ended', { channelId });
    });

    // 举手/放下
    socket.on('huddle:hand', ({ channelId, raised }: { channelId: string; raised: boolean }) => {
      const call = activeCalls.get(channelId);
      if (!call) return;
      const p = call.participants.get(user.id);
      if (p) p.handRaised = raised;

      io.to(`huddle:${channelId}`).emit('huddle:hand-update', { userId: user.id, raised });
    });

    // 查询频道是否有活跃通话
    socket.on('huddle:check', ({ channelId }: { channelId: string }) => {
      const call = activeCalls.get(channelId);
      if (call) {
        const participants = Array.from(call.participants.entries()).map(([id, p]) => ({
          userId: id,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          handRaised: p.handRaised,
        }));
        socket.emit('huddle:active', {
          callId: call.callId,
          channelId,
          participants,
          startedAt: call.startedAt,
        });
      } else {
        socket.emit('huddle:inactive', { channelId });
      }
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.displayName} disconnected`);

      // 清理该用户参与的所有通话
      for (const [channelId, call] of activeCalls.entries()) {
        if (call.participants.has(user.id)) {
          call.participants.delete(user.id);
          socket.to(`huddle:${channelId}`).emit('huddle:participant-left', { userId: user.id, displayName: user.displayName });

          if (call.participants.size === 0) {
            activeCalls.delete(channelId);
            io.to(channelId).emit('huddle:ended', { channelId });
          }
        }
      }

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
