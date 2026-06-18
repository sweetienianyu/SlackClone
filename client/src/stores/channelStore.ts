import { create } from 'zustand';
import type { Channel, Message } from '../types';
import { api } from '../services/api';

interface ChannelState {
  channels: Channel[];
  currentChannel: Channel | null;
  messages: Message[];
  unreadCounts: Record<string, number>;
  setChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channel: Channel) => void;
  addChannel: (channel: Channel) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setUnreadCount: (channelId: string, count: number) => void;
  loadUnreadCounts: (workspaceId: string) => Promise<void>;
  markAsRead: (channelId: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  currentChannel: null,
  messages: [],
  unreadCounts: {},
  setChannels: (channels) => set({ channels }),
  setCurrentChannel: (channel) => {
    set((s) => ({ currentChannel: channel, messages: [], unreadCounts: { ...s.unreadCounts, [channel.id]: 0 } }));
    // 标记为已读
    get().markAsRead(channel.id);
  },
  addChannel: (channel) => set((s) => ({ channels: [...s.channels, channel] })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setUnreadCount: (channelId, count) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [channelId]: count } })),
  loadUnreadCounts: async (workspaceId) => {
    try {
      const counts = await api.getUnreadCounts(workspaceId);
      set({ unreadCounts: counts });
    } catch { /* ignore */ }
  },
  markAsRead: async (channelId) => {
    try {
      await api.markChannelRead(channelId);
      set((s) => ({ unreadCounts: { ...s.unreadCounts, [channelId]: 0 } }));
    } catch { /* ignore */ }
  },
}));
