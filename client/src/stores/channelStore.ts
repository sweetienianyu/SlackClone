import { create } from 'zustand';
import type { Channel, Message } from '../types';

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
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  currentChannel: null,
  messages: [],
  unreadCounts: {},
  setChannels: (channels) => set({ channels }),
  setCurrentChannel: (channel) => set((s) => ({ currentChannel: channel, messages: [], unreadCounts: { ...s.unreadCounts, [channel.id]: 0 } })),
  addChannel: (channel) => set((s) => ({ channels: [...s.channels, channel] })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setUnreadCount: (channelId, count) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [channelId]: count } })),
}));
