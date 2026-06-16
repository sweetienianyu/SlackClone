export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  type: 'public' | 'private' | 'dm';
  topic: string | null;
  description: string | null;
  createdBy: string;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  parentId: string | null;
  type: 'text' | 'file' | 'system';
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  reactions: Reaction[];
  editedAt: string | null;
  createdAt: string;
  user?: User;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  user?: User;
}

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: 'admin' | 'member';
  lastReadAt: string | null;
  muted: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
