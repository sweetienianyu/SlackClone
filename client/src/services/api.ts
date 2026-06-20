import { useAuthStore } from '../stores/authStore';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }

  return res.json();
}

async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '上传失败');
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; refreshToken: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; username: string; password: string; displayName: string }) =>
    request<{ token: string; refreshToken: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<any>('/auth/me'),
  updateProfile: (data: { displayName?: string; username?: string; status?: string; avatarUrl?: string }) =>
    request<any>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Workspaces
  getWorkspaces: () => request<any[]>('/workspaces'),
  createWorkspace: (data: { name: string }) =>
    request<any>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  getWorkspaceMembers: (id: string) => request<any[]>(`/workspaces/${id}/members`),
  inviteToWorkspace: (id: string, email: string) =>
    request<any>(`/workspaces/${id}/invite`, { method: 'POST', body: JSON.stringify({ email }) }),
  joinWorkspace: (inviteCode: string) =>
    request<any>('/workspaces/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  getInviteCode: (id: string) =>
    request<{ inviteCode: string }>(`/workspaces/${id}/invite-code`),
  regenerateInviteCode: (id: string) =>
    request<{ inviteCode: string }>(`/workspaces/${id}/regenerate-invite`, { method: 'POST' }),

  // Admin
  getAdminStats: (id: string) => request<any>(`/workspaces/${id}/admin/stats`),
  getAdminMembers: (id: string) => request<any[]>(`/workspaces/${id}/admin/members`),
  updateMemberRole: (wsId: string, userId: string, role: string) =>
    request<any>(`/workspaces/${wsId}/admin/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  getAdminChannels: (id: string) => request<any[]>(`/workspaces/${id}/admin/channels`),
  deleteAdminChannel: (wsId: string, channelId: string) =>
    request<any>(`/workspaces/${wsId}/admin/channels/${channelId}`, { method: 'DELETE' }),

  // Channels
  getChannels: (workspaceId: string) =>
    request<any[]>(`/channels?workspace_id=${workspaceId}`),
  createChannel: (data: { workspaceId: string; name: string; type: string; topic?: string; groupId?: string }) =>
    request<any>('/channels', { method: 'POST', body: JSON.stringify(data) }),
  getChannel: (id: string) => request<any>(`/channels/${id}`),
  updateChannel: (id: string, data: { name?: string; topic?: string; description?: string; groupId?: string }) =>
    request<any>(`/channels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  joinChannel: (id: string) => request<any>(`/channels/${id}/join`, { method: 'POST' }),
  leaveChannel: (id: string) => request<any>(`/channels/${id}/leave`, { method: 'POST' }),
  pinChannel: (id: string) => request<{ pinned: boolean }>(`/channels/${id}/pin`, { method: 'POST' }),
  pinMessage: (channelId: string, messageId: string) =>
    request<{ pinned: boolean }>(`/channels/${channelId}/pin-message`, { method: 'POST', body: JSON.stringify({ messageId }) }),
  getPinnedMessages: (channelId: string) =>
    request<any[]>(`/channels/${channelId}/pinned`),
  createDm: (workspaceId: string, targetUserId: string) =>
    request<any>('/channels/dm', { method: 'POST', body: JSON.stringify({ workspaceId, targetUserId }) }),
  getChannelMembers: (id: string) => request<any[]>(`/channels/${id}/members`),
  inviteToChannel: (id: string, userId: string) =>
    request<any>(`/channels/${id}/invite`, { method: 'POST', body: JSON.stringify({ userId }) }),

  // Channel Groups
  getChannelGroups: (workspaceId: string) =>
    request<any[]>(`/channels/groups/list?workspace_id=${workspaceId}`),
  createChannelGroup: (data: { workspaceId: string; name: string; sort?: number }) =>
    request<any>('/channels/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateChannelGroup: (id: string, data: { name?: string; sort?: number }) =>
    request<any>(`/channels/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChannelGroup: (id: string) =>
    request<any>(`/channels/groups/${id}`, { method: 'DELETE' }),

  // Channel notification preferences & mute
  updateNotifyPreference: (channelId: string, preference: 'all' | 'mentions' | 'none') =>
    request<any>(`/channels/${channelId}/notification-preference`, { method: 'PUT', body: JSON.stringify({ preference }) }),
  muteChannel: (channelId: string, duration: '1h' | 'until_tomorrow' | 'off') =>
    request<any>(`/channels/${channelId}/mute`, { method: 'POST', body: JSON.stringify({ duration }) }),

  // Unread counts & mark as read
  getUnreadCounts: (workspaceId: string) =>
    request<Record<string, number>>(`/channels/unread/count?workspace_id=${workspaceId}`),
  markChannelRead: (channelId: string) =>
    request<any>(`/channels/${channelId}/read`, { method: 'POST' }),

  // Channel favorite
  favoriteChannel: (channelId: string) =>
    request<{ favorited: boolean }>(`/channels/${channelId}/favorite`, { method: 'POST' }),

  // Group DM
  createGroupDM: (data: { workspaceId: string; targetUserIds: string[]; name?: string }) =>
    request<any>('/channels/dm/group', { method: 'POST', body: JSON.stringify(data) }),

  // Documents
  getDocuments: (workspaceId: string, channelId?: string) =>
    request<any[]>(`/documents?workspace_id=${workspaceId}${channelId ? `&channel_id=${channelId}` : ''}`),
  getDocument: (id: string) => request<any>(`/documents/${id}`),
  createDocument: (data: { workspaceId: string; title: string; content?: string; template?: string; channelId?: string }) =>
    request<any>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  updateDocument: (id: string, data: { title?: string; content?: string }) =>
    request<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDocument: (id: string) =>
    request<any>(`/documents/${id}`, { method: 'DELETE' }),
  getDocumentTemplates: () =>
    request<{ templates: any[]; categories: string[] }>('/documents/templates/list'),
  getDocumentTemplate: (key: string) =>
    request<any>(`/documents/templates/${key}`),

  // Messages
  getMessages: (channelId: string, cursor?: string) =>
    request<any[]>(`/messages?channel_id=${channelId}${cursor ? `&cursor=${cursor}` : ''}`),
  sendMessage: (data: { channelId: string; content: string; parentId?: string }) =>
    request<any>('/messages', { method: 'POST', body: JSON.stringify(data) }),
  editMessage: (id: string, content: string) =>
    request<any>(`/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (id: string) =>
    request<any>(`/messages/${id}`, { method: 'DELETE' }),
  addReaction: (id: string, emoji: string) =>
    request<any>(`/messages/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  getThread: (id: string) => request<any[]>(`/messages/${id}/thread`),

  // Files
  uploadFile: (channelId: string, file: File, content?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channelId', channelId);
    if (content) formData.append('content', content);
    return uploadFile<any>('/files/upload', formData);
  },
  getFiles: (channelId: string, type?: string, uploaderId?: string) =>
    request<any[]>(`/files?channel_id=${channelId}${type ? `&type=${type}` : ''}${uploaderId ? `&uploader_id=${uploaderId}` : ''}`),
  searchFiles: (q: string, workspaceId: string) =>
    request<any[]>(`/files/search?q=${encodeURIComponent(q)}&workspace_id=${workspaceId}`),
  downloadFile: (messageId: string) => `/api/files/${messageId}/download`,

  // Search
  search: (params: {
    q: string;
    workspaceId?: string;
    channelId?: string;
    userId?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams({ q: params.q });
    if (params.workspaceId) query.set('workspace_id', params.workspaceId);
    if (params.channelId) query.set('channel_id', params.channelId);
    if (params.userId) query.set('user_id', params.userId);
    if (params.type) query.set('type', params.type);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.limit) query.set('limit', String(params.limit));
    return request<any[]>(`/search?${query.toString()}`);
  },
};
