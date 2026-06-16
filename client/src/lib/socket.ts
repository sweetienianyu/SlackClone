import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useChannelStore } from '../stores/channelStore';

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
    // 可以用单独的 store 或 UI state 处理
    console.log(`[Typing] ${userId} in ${channelId}: ${isTyping}`);
  });

  socket.on('unread:update', ({ channelId, count }) => {
    useChannelStore.getState().setUnreadCount(channelId, count);
  });

  // @提及通知
  socket.on('notification:mention', (data) => {
    console.log('[Notification] You were mentioned:', data);
    // 可以用浏览器通知或 toast
    if (Notification.permission === 'granted') {
      new Notification(`@${data.fromUser} 在 #${data.channelName} 提到了你`, {
        body: data.content,
      });
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

export function getSocket() {
  return socket;
}
