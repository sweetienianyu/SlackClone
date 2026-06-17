import { useEffect, useRef, useState, useCallback } from 'react';
import { useChannelStore } from '../../stores/channelStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { api } from '../../services/api';
import { emitTyping, emitThreadOpen } from '../../lib/socket';
import { formatTime, getInitial } from '../../lib/utils';
import type { Message } from '../../types';

const AVATAR_COLORS = ['#611f69', '#1264a3', '#0f7840', '#da2e38', '#ecb22e', '#e01e5a'];

const EMOJI_LIST = [
  '👍', '❤️', '😄', '😂', '😮', '😢', '😡', '🎉',
  '🔥', '👀', '💯', '✅', '❌', '⭐', '🚀', '💪',
  '🙏', '👏', '🤔', '😴', '🥳', '😱', '🤝', '💡',
  '📎', '📌', '🎯', '💬', '🏆', '🌟', '☕', '🍕',
];

function renderContent(content: string) {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="bg-blue-100 text-info font-semibold px-0.5 rounded">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function MessageArea() {
  const { currentChannel, messages } = useChannelStore();
  const { user } = useAuthStore();
  const { openThread } = useUIStore();
  const { currentWorkspace } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 顶部导航面板状态
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [wsMembers, setWsMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // 表情选择器
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<{ msgId: string; type: 'input' | 'reaction' } | null>(null);

  // @提及
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);

  // 通知列表
  const [notifications, setNotifications] = useState<any[]>([]);

  // 拖拽上传状态
  const [dragOver, setDragOver] = useState(false);

  // 文件预览状态
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 组件挂载时立即加载工作区成员（@提及和点赞用户列表都需要）
  useEffect(() => {
    loadWorkspaceMembers();
  }, [currentWorkspace?.id]);

  // 加载工作区成员
  const loadWorkspaceMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getWorkspaceMembers(currentWorkspace.id);
      setWsMembers(data);
      const myMember = data.find((m: any) => m.userId === user?.id);
      setIsAdmin(myMember?.role === 'admin');
      if (myMember?.role === 'admin') {
        try {
          const res = await api.getInviteCode(currentWorkspace.id);
          setInviteCode(res.inviteCode || '');
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('加载工作区成员失败:', err);
    }
  }, [currentWorkspace?.id, user?.id]);

  useEffect(() => {
    if (showMemberPanel) loadWorkspaceMembers();
  }, [showMemberPanel, loadWorkspaceMembers]);

  // 加载通知
  const loadNotifications = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      // 获取当前用户被@的消息作为通知
      const channels = await api.getChannels(currentWorkspace.id);
      const allNotifs: any[] = [];
      for (const ch of channels) {
        try {
          const msgs = await api.getMessages(ch.id);
          const mentions = msgs.filter(
            (m: any) => m.content?.includes(`@${user?.username}`) && m.userId !== user?.id
          );
          allNotifs.push(...mentions.map((m: any) => ({ ...m, channelName: ch.name, channelId: ch.id })));
        } catch { /* skip */ }
      }
      allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(allNotifs.slice(0, 20));
    } catch (err) {
      console.error('加载通知失败:', err);
    }
  }, [currentWorkspace?.id, user?.id, user?.username]);

  useEffect(() => {
    if (showNotifPanel) loadNotifications();
  }, [showNotifPanel, loadNotifications]);

  const handleSend = async () => {
    if (!input.trim() || !currentChannel || sending) return;
    setSending(true);
    try {
      await api.sendMessage({ channelId: currentChannel.id, content: input.trim() });
      setInput('');
      setShowMention(false);
    } catch (err: any) {
      alert(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMention) {
      e.preventDefault();
      handleSend();
    }
    if (currentChannel) {
      emitTyping(currentChannel.id, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(currentChannel.id, false);
      }, 3000);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // 检测 @ 输入
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMention(true);
      setMentionQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[0].length);
    } else {
      setShowMention(false);
    }
  };

  const handleMentionSelect = (username: string) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(mentionStart + mentionQuery.length + 1);
    setInput(before + `@${username} ` + after);
    setShowMention(false);
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    try {
      await api.addReaction(msgId, emoji);
    } catch (err) {
      console.error('添加反应失败:', err);
    }
  };

  const handleOpenThread = (msgId: string) => {
    openThread(msgId);
    if (currentChannel) emitThreadOpen(msgId, currentChannel.id);
  };

  const handleEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const handleEditSave = async (msgId: string) => {
    if (!editContent.trim()) return;
    try {
      await api.editMessage(msgId, editContent.trim());
      setEditingId(null);
      setEditContent('');
    } catch (err: any) {
      alert(err.message || '编辑失败');
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('确定删除这条消息？')) return;
    try {
      await api.deleteMessage(msgId);
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentChannel) return;
    for (let i = 0; i < files.length; i++) {
      try {
        await api.uploadFile(currentChannel.id, files[i]);
      } catch (err: any) {
        alert(err.message || '上传失败');
      }
    }
    e.target.value = '';
  };

  // 拖拽上传处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!currentChannel) return;
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      try {
        await api.uploadFile(currentChannel.id, files[i]);
      } catch (err: any) {
        alert(err.message || '上传失败');
      }
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentWorkspace) return;
    try {
      await api.inviteToWorkspace(currentWorkspace.id, inviteEmail.trim());
      alert('邀请成功！');
      setShowInvite(false);
      setInviteEmail('');
      loadWorkspaceMembers();
    } catch (err: any) {
      alert(err.message || '邀请失败');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('确定移除该成员？')) return;
    try {
      await fetch(`/api/workspaces/${currentWorkspace?.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      });
      loadWorkspaceMembers();
    } catch (err: any) {
      alert(err.message || '移除失败');
    }
  };

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg">选择一个频道开始聊天</p>
        </div>
      </div>
    );
  }

  const isDm = currentChannel.type === 'dm';
  const channelIcon = isDm ? '' : currentChannel.type === 'private' ? '🔒' : '#';
  const channelDisplayName = isDm ? ((currentChannel as any).displayName || currentChannel.name) : currentChannel.name;

  // 过滤提及候选
  const mentionCandidates = wsMembers.filter(
    (m: any) => m.user && (m.user.username?.toLowerCase().includes(mentionQuery.toLowerCase()) || m.user.displayName?.toLowerCase().includes(mentionQuery.toLowerCase()))
  );

  // 按日期分组消息
  const groupedMessages = messages.reduce<Record<string, Message[]>>((acc, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString('zh-CN');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col min-w-0 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽上传遮罩 */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">📎</div>
            <p className="text-primary font-medium">拖拽文件到此处上传</p>
            <p className="text-xs text-gray-500 mt-1">支持 jpg/png/gif/pdf/doc/txt</p>
          </div>
        </div>
      )}
      {/* 频道头部 */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-400 text-lg">{channelIcon}</span>
          <h3 className="font-bold text-base truncate">{channelDisplayName}</h3>
          {currentChannel.topic && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500 truncate">{currentChannel.topic}</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {/* 成员按钮 */}
          <button
            onClick={() => { setShowMemberPanel(!showMemberPanel); setShowNotifPanel(false); }}
            className={`text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 ${showMemberPanel ? 'bg-gray-100 text-gray-600' : ''}`}
            title="成员"
          >👥</button>
          {/* 通知按钮 */}
          <button
            onClick={() => { setShowNotifPanel(!showNotifPanel); setShowMemberPanel(false); }}
            className={`text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 relative ${showNotifPanel ? 'bg-gray-100 text-gray-600' : ''}`}
            title="通知"
          >
            🔔
            {notifications.length > 0 && !showNotifPanel && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{notifications.length > 9 ? '9+' : notifications.length}</span>
            )}
          </button>
          <button className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100" title="固定消息">📌</button>
          <button
            onClick={async () => {
              if (!currentChannel) return;
              try {
                const detail = await api.getChannel(currentChannel.id);
                // 打开频道详情 — 通过 CustomEvent 通知 ChannelList
                window.dispatchEvent(new CustomEvent('channel:open-detail', { detail: currentChannel }));
              } catch {}
            }}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100"
            title="频道详情"
          >ℹ️</button>
        </div>
      </div>

      {/* 成员面板 */}
      {showMemberPanel && (
        <div className="absolute right-0 top-14 w-80 bg-white border-l border-b border-gray-200 shadow-lg z-40 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">成员 ({wsMembers.length})</h4>
              {isAdmin && (
                <button
                  onClick={() => { setShowInvite(true); }}
                  className="text-xs text-primary hover:underline"
                >+ 邀请</button>
              )}
            </div>

            {/* 邀请码（仅管理员） */}
            {isAdmin && inviteCode && (
              <div className="mb-3 p-2 bg-purple-50 rounded border border-purple-200">
                <p className="text-xs text-purple-600 font-medium mb-1">邀请码</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-white px-2 py-0.5 rounded border border-purple-200 select-all">{inviteCode}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteCode)}
                    className="text-xs text-purple-600 hover:text-purple-800 px-1 py-0.5 rounded hover:bg-purple-100"
                  >复制</button>
                </div>
              </div>
            )}

            {wsMembers.map((m: any) => (
              <div key={m.userId} className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded px-1">
                <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {m.user?.displayName ? m.user.displayName.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.user?.displayName || m.userId}</p>
                  <p className="text-xs text-gray-400 truncate">{m.user?.email}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {m.role === 'admin' ? '管理员' : '成员'}
                </span>
                {isAdmin && m.role !== 'admin' && m.userId !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 px-1 py-0.5 rounded"
                  >移除</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 通知面板 */}
      {showNotifPanel && (
        <div className="absolute right-0 top-14 w-80 bg-white border-l border-b border-gray-200 shadow-lg z-40 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-4">
            <h4 className="font-bold text-sm mb-3">通知</h4>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">暂无通知</p>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">#</span>
                    <span className="text-xs text-gray-500">{n.channelName}</span>
                  </div>
                  <p className="text-sm mt-0.5">
                    <span className="font-medium">{n.user?.displayName}</span>
                    <span className="text-gray-500">: </span>
                    <span className="text-gray-700">{n.content?.slice(0, 80)}</span>
                  </p>
                  <span className="text-[10px] text-gray-400">{formatTime(n.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 邀请成员弹窗 */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-bold text-lg mb-2">邀请成员</h3>
            <p className="text-sm text-gray-500 mb-4">输入对方邮箱，邀请其加入「{currentWorkspace?.name}」工作区</p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4"
              placeholder="name@example.com"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowInvite(false); setInviteEmail(''); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleInvite} className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light">邀请</button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4" onClick={() => { setShowMemberPanel(false); setShowNotifPanel(false); }}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="px-3 text-xs text-gray-400 font-medium">{date}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {msgs.map((msg, idx) => {
              const prevMsg = idx > 0 ? msgs[idx - 1] : null;
              const isSameUser = prevMsg?.userId === msg.userId;
              const isOwn = msg.userId === user?.id;
              const isEditing = editingId === msg.id;
              const isFile = msg.type === 'file';

              return (
                <div
                  key={msg.id}
                  className={`group flex gap-2.5 py-1 px-1 -mx-1 rounded hover:bg-slack-msg-hover ${
                    isSameUser ? 'pl-12' : 'mt-3'
                  }`}
                >
                  {!isSameUser && (
                    <div
                      className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: AVATAR_COLORS[parseInt(msg.userId) % AVATAR_COLORS.length] || '#611f69' }}
                    >
                      {msg.user ? getInitial(msg.user.displayName) : getInitial(msg.userId)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {!isSameUser && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-sm">{msg.user?.displayName || msg.userId}</span>
                        <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                      </div>
                    )}

                    {/* 编辑模式 */}
                    {isEditing ? (
                      <div className="mt-1">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(msg.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full px-2 py-1 border border-info rounded text-sm focus:outline-none focus:ring-1 focus:ring-info"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => handleEditSave(msg.id)} className="text-xs text-primary font-medium hover:underline">保存</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:underline">取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 文件消息 */}
                        {isFile && msg.fileUrl && (
                          <div className="mt-1 mb-1">
                            {msg.fileType?.startsWith('image/') ? (
                              <div className="relative group/img inline-block">
                                <img
                                  src={msg.fileUrl}
                                  alt={msg.fileName || '图片'}
                                  className="max-w-sm max-h-64 rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewFile({ url: msg.fileUrl!, name: msg.fileName || '图片', type: msg.fileType || 'image' })}
                                />
                                <a
                                  href={api.downloadFile(msg.id)}
                                  download
                                  className="absolute top-2 right-2 hidden group-hover/img:flex items-center gap-1 px-2 py-1 bg-black/60 text-white text-xs rounded hover:bg-black/80"
                                >
                                  ⬇ 下载
                                </a>
                              </div>
                            ) : msg.fileType === 'application/pdf' ? (
                              <div className="border border-gray-200 rounded-lg overflow-hidden max-w-sm">
                                <iframe
                                  src={msg.fileUrl}
                                  className="w-full h-48"
                                  title={msg.fileName || 'PDF'}
                                />
                                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-red-500 text-lg">📄</span>
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-gray-800 truncate">{msg.fileName || 'PDF'}</div>
                                      {msg.fileSize && <div className="text-xs text-gray-400">{(msg.fileSize / 1024).toFixed(1)} KB</div>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setPreviewFile({ url: msg.fileUrl!, name: msg.fileName || 'PDF', type: msg.fileType || 'application/pdf' })}
                                      className="text-xs text-primary hover:underline px-2 py-1"
                                    >预览</button>
                                    <a
                                      href={api.downloadFile(msg.id)}
                                      download
                                      className="text-xs text-primary hover:underline px-2 py-1"
                                    >下载</a>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors max-w-sm">
                                <span className="text-2xl">
                                  {msg.fileType?.startsWith('text/') ? '📝' : '📎'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-800 truncate">{msg.fileName || '文件'}</div>
                                  {msg.fileSize && <div className="text-xs text-gray-400">{(msg.fileSize / 1024).toFixed(1)} KB</div>}
                                </div>
                                <a
                                  href={api.downloadFile(msg.id)}
                                  download
                                  className="text-xs text-primary hover:underline px-2 py-1 flex-shrink-0"
                                >下载</a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 文本内容 */}
                        <div className="text-sm text-gray-800 break-words whitespace-pre-wrap">
                          {renderContent(msg.content)}
                        </div>

                        {/* 已编辑标记 */}
                        {msg.editedAt && !isEditing && (
                          <span className="text-xs text-gray-400 italic ml-1">(已编辑)</span>
                        )}
                      </>
                    )}

                    {/* 反应 - 显示用户列表 */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {msg.reactions.map((r, i) => {
                          const userIds: string[] = r.userIds || [];
                          const reactedByMe = userIds.includes(user?.id || '');
                          return (
                            <div key={i} className="relative group/reaction">
                              <button
                                onClick={() => handleReaction(msg.id, r.emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 transition-colors ${
                                  reactedByMe
                                    ? 'bg-blue-50 border-blue-300 shadow-sm'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                }`}
                              >
                                <span className="text-sm">{r.emoji}</span>
                                <span className="text-gray-600 font-medium">{userIds.length}</span>
                              </button>
                              {/* 悬停显示用户列表 - 类似 Slack/飞书 */}
                              {userIds.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover/reaction:block bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 px-1 z-50 min-w-[140px] max-w-[220px]">
                                  <div className="text-[10px] text-gray-400 px-2 pb-1 border-b border-gray-100 mb-1">
                                    {userIds.length} 人 reacted
                                  </div>
                                  {userIds.map((uid) => {
                                    const member = wsMembers.find((m: any) => m.userId === uid);
                                    const displayName = member?.user?.displayName || uid.slice(0, 6);
                                    const initial = displayName.charAt(0).toUpperCase();
                                    return (
                                      <div key={uid} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50">
                                        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                                          {initial}
                                        </div>
                                        <span className="text-xs text-gray-700 truncate">{displayName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 线程回复数 */}
                    {(msg as any)._count?.replies > 0 && (
                      <button
                        onClick={() => handleOpenThread(msg.id)}
                        className="mt-1 text-xs text-info hover:underline flex items-center gap-1"
                      >
                        💬 {(msg as any)._count.replies} 条回复
                      </button>
                    )}

                    {/* 悬停操作栏 */}
                    {!isEditing && (
                      <div className="hidden group-hover:flex items-center gap-1 mt-1">
                        <button
                          onClick={() => handleOpenThread(msg.id)}
                          className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm"
                        >
                          💬 回复
                        </button>
                        <button
                          onClick={() => { setEmojiPickerTarget({ msgId: msg.id, type: 'reaction' }); setShowEmojiPicker(true); }}
                          className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm"
                        >😊</button>
                        <button onClick={() => handleReaction(msg.id, '👍')} className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm">👍</button>
                        <button
                          onClick={async () => {
                            if (!currentChannel) return;
                            try { await api.pinMessage(currentChannel.id, msg.id); } catch (err: any) { alert(err.message || '操作失败'); }
                          }}
                          className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm"
                          title="置顶消息"
                        >📌</button>
                        {isOwn && (
                          <>
                            <button onClick={() => handleEdit(msg)} className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm">✏️</button>
                            <button onClick={() => handleDelete(msg.id)} className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-red-50 shadow-sm text-red-500">🗑️</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji 选择器 */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-1/3 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 w-72">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">选择表情</span>
            <button onClick={() => setShowEmojiPicker(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  if (emojiPickerTarget?.type === 'reaction' && emojiPickerTarget.msgId) {
                    handleReaction(emojiPickerTarget.msgId, emoji);
                  } else if (emojiPickerTarget?.type === 'input') {
                    setInput((prev) => prev + emoji);
                  }
                  setShowEmojiPicker(false);
                  setEmojiPickerTarget(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 输入框 */}
      <div className="px-5 pb-4">
        <div className="border border-gray-300 rounded-lg bg-white focus-within:border-info focus-within:ring-1 focus-within:ring-info relative">
          {/* @提及候选 */}
          {showMention && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-xl w-56 max-h-40 overflow-y-auto z-50">
              {mentionCandidates.slice(0, 6).map((m: any) => (
                <button
                  key={m.userId}
                  onClick={() => handleMentionSelect(m.user.username)}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 flex items-center gap-2 text-sm"
                >
                  <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">
                    {m.user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{m.user.displayName}</span>
                  <span className="text-gray-400 text-xs">@{m.user.username}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2.5 text-sm resize-none outline-none min-h-[40px] max-h-[200px]"
            placeholder={`发消息到 ${isDm ? '' : channelIcon}${channelDisplayName}`}
            rows={1}
          />
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.csv" multiple />
              <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-gray-600 text-sm" title="上传文件">📎</button>
              <button
                onClick={() => { setEmojiPickerTarget({ msgId: '', type: 'input' }); setShowEmojiPicker(!showEmojiPicker); }}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title="表情"
              >😊</button>
              <button
                onClick={() => setInput((prev) => prev + '@')}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title="@提及"
              >@</button>
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="text-primary hover:text-primary-light disabled:text-gray-300 transition-colors"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* 文件预览弹窗 */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium truncate">{previewFile.name}</span>
              <button onClick={() => setPreviewFile(null)} className="text-white/70 hover:text-white text-xl ml-4">✕</button>
            </div>
            {previewFile.type.startsWith('image/') ? (
              <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[80vh] mx-auto rounded-lg" />
            ) : previewFile.type === 'application/pdf' ? (
              <iframe src={previewFile.url} className="w-full h-[80vh] bg-white rounded-lg" title={previewFile.name} />
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <div className="text-4xl mb-4">📎</div>
                <p className="text-gray-600 mb-4">此文件类型不支持在线预览</p>
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  className="text-primary hover:underline"
                >下载文件</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
