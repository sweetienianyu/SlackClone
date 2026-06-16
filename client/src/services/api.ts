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

  // Channels
  getChannels: (workspaceId: string) =>
    request<any[]>(`/channels?workspace_id=${workspaceId}`),
  createChannel: (data: { workspaceId: string; name: string; type: string; topic?: string }) =>
    request<any>('/channels', { method: 'POST', body: JSON.stringify(data) }),
  getChannel: (id: string) => request<any>(`/channels/${id}`),
  joinChannel: (id: string) => request<any>(`/channels/${id}/join`, { method: 'POST' }),
  createDm: (workspaceId: string, targetUserId: string) =>
    request<any>('/channels/dm', { method: 'POST', body: JSON.stringify({ workspaceId, targetUserId }) }),
  getChannelMembers: (id: string) => request<any[]>(`/channels/${id}/members`),
  inviteToChannel: (id: string, userId: string) =>
    request<any>(`/channels/${id}/invite`, { method: 'POST', body: JSON.stringify({ userId }) }),

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
  search: (q: string) => request<any[]>(`/search?q=${encodeURIComponent(q)}`),
};
