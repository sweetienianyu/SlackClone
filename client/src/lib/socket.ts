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
    const { currentChannel } = useChannelStore.getState();
    if (message.channelId === currentChannel?.id) {
      useChannelStore.getState().addMessage(message);
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

  socket.on('unread:update', ({ channelId, count }) => {
    useChannelStore.getState().setUnreadCount(channelId, count);
  });

  // @提及通知
  socket.on('notification:mention', (data) => {
    console.log('[Notification] You were mentioned:', data);
    // 浏览器通知
    if (Notification.permission === 'granted') {
      new Notification(`@${data.fromUser} 在 #${data.channelName} 提到了你`, {
        body: data.content,
      });
    }
    // 同时更新通知列表（通过 uiStore 或 channelStore）
    const { currentChannel } = useChannelStore.getState();
    if (currentChannel && data.channelId === currentChannel.id) {
      // 当前频道被@时，可以高亮或标记
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
