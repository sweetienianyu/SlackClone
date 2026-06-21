import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useChannelStore } from '../stores/channelStore';
import { useUIStore } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { api } from '../services/api';

let socket: Socket | null = null;

export function connectSocket() {
  const token = useAuthStore.getState().token;
  if (!token || socket?.connected) return;

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('message:new', (message) => {
    const { currentChannel, addMessage, setUnreadCount, unreadCounts } = useChannelStore.getState();
    if (message.channelId === currentChannel?.id) {
      addMessage(message);
    } else {
      // 不在当前频道，增加未读计数
      const current = unreadCounts[message.channelId] || 0;
      setUnreadCount(message.channelId, current + 1);
    }
  });

  socket.on('message:update', (message) => {
    const { messages, setMessages } = useChannelStore.getState();
    setMessages(messages.map((m) => (m.id === message.id ? message : m)));
  });

  socket.on('message:delete', ({ id }) => {
    const { messages, setMessages } = useChannelStore.getState();
    setMessages(messages.filter((m) => m.id !== id));
  });

  socket.on('user:typing', ({ userId, channelId, isTyping }) => {
    console.log(`[Typing] ${userId} in ${channelId}: ${isTyping}`);
  });

  // 用户在线状态变化
  socket.on('user:status', ({ userId, status }) => {
    console.log(`[Status] ${userId} is now ${status}`);
    window.dispatchEvent(new CustomEvent('user:status-change', { detail: { userId, status } }));
  });

  socket.on('unread:update', ({ channelId, count }) => {
    useChannelStore.getState().setUnreadCount(channelId, count);
  });

  // @提及通知
  socket.on('notification:mention', (data) => {
    console.log('[Notification] You were mentioned:', data);
    // 浏览器桌面通知
    if (Notification.permission === 'granted') {
      const n = new Notification(`@${data.fromUser} 在 #${data.channelName} 提到了你`, {
        body: data.content,
        tag: `mention-${data.messageId}`,
      });
      n.onclick = () => {
        window.focus();
        const { channels, setCurrentChannel } = useChannelStore.getState();
        const ch = channels.find((c) => c.id === data.channelId);
        if (ch) setCurrentChannel(ch);
        n.close();
      };
    }
    // 增加未读计数
    const { currentChannel, unreadCounts, setUnreadCount } = useChannelStore.getState();
    if (!currentChannel || currentChannel.id !== data.channelId) {
      setUnreadCount(data.channelId, (unreadCounts[data.channelId] || 0) + 1);
    }
  });

  // 桌面通知（按通知偏好推送的普通消息）
  socket.on('notification:desktop', (data) => {
    console.log('[Desktop Notification]', data);
    if (Notification.permission === 'granted') {
      const n = new Notification(data.title, {
        body: data.body,
        tag: `msg-${data.messageId}`,
      });
      n.onclick = () => {
        window.focus();
        const { channels, setCurrentChannel } = useChannelStore.getState();
        const ch = channels.find((c) => c.id === data.channelId);
        if (ch) setCurrentChannel(ch);
        n.close();
      };
    }
  });

  // 线程打开/关闭 - 其他用户打开了线程面板
  socket.on('thread:open', (data) => {
    console.log('[Thread] User opened thread for message:', data.messageId);
    const { openThread } = useUIStore.getState();
    openThread(data.messageId);
  });

  socket.on('thread:close', () => {
    console.log('[Thread] User closed thread panel');
    const { closeThread } = useUIStore.getState();
    closeThread();
  });

  // 被邀请加入工作区 - 自动刷新工作区列表并切换
  socket.on('workspace:invited', async (data) => {
    console.log('[Workspace] Invited to workspace:', data.workspaceId);
    try {
      const workspaces = await api.getWorkspaces();
      const { setWorkspaces, setCurrentWorkspace } = useWorkspaceStore.getState();
      setWorkspaces(workspaces);
      const target = workspaces.find((w: any) => w.id === data.workspaceId);
      if (target) setCurrentWorkspace(target);
    } catch (err) {
      console.error('[Workspace] Failed to refresh after invite:', err);
    }
  });

  // 线程新回复 - 实时追加到已打开的线程面板
  socket.on('thread:reply', (data) => {
    console.log('[Thread] New reply for message:', data.parentId);
    // 通过自定义事件通知 ThreadPanel 刷新
    window.dispatchEvent(new CustomEvent('thread:new-reply', { detail: data }));
    // 同时更新主消息列表中父消息的回复计数
    const { messages, setMessages } = useChannelStore.getState();
    setMessages(
      messages.map((m) =>
        m.id === data.parentId
          ? { ...m, _count: { ...((m as any)._count || {}), replies: (((m as any)._count?.replies || 0) + 1) } }
          : m
      )
    );
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinChannel(channelId: string) {
  socket?.emit('channel:join', channelId);
}

export function leaveChannel(channelId: string) {
  socket?.emit('channel:leave', channelId);
}

export function emitTyping(channelId: string, isTyping: boolean) {
  socket?.emit('user:typing', { channelId, isTyping });
}

// 打开线程时广播给同频道其他用户
export function emitThreadOpen(messageId: string, channelId: string) {
  socket?.emit('thread:open', { messageId, channelId });
}

// 关闭线程时广播
export function emitThreadClose() {
  socket?.emit('thread:close');
}

export function getSocket() {
  return socket;
}

// ============ Huddles 音视频通话 ============

export function huddleStart(channelId: string) {
  socket?.emit('huddle:start', { channelId });
}

export function huddleJoin(channelId: string) {
  socket?.emit('huddle:join', { channelId });
}

export function huddleLeave(channelId: string) {
  socket?.emit('huddle:leave', { channelId });
}

export function huddleEnd(channelId: string) {
  socket?.emit('huddle:end', { channelId });
}

export function huddleOffer(channelId: string, targetUserId: string, offer: RTCSessionDescriptionInit) {
  socket?.emit('huddle:offer', { channelId, targetUserId, offer });
}

export function huddleAnswer(channelId: string, targetUserId: string, answer: RTCSessionDescriptionInit) {
  socket?.emit('huddle:answer', { channelId, targetUserId, answer });
}

export function huddleIceCandidate(channelId: string, targetUserId: string, candidate: RTCIceCandidateInit) {
  socket?.emit('huddle:ice-candidate', { channelId, targetUserId, candidate });
}

export function huddleHand(channelId: string, raised: boolean) {
  socket?.emit('huddle:hand', { channelId, raised });
}

export function huddleCheck(channelId: string) {
  socket?.emit('huddle:check', { channelId });
}
