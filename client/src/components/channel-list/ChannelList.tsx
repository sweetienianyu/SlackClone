import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useChannelStore } from '../../stores/channelStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import { joinChannel } from '../../lib/socket';
import type { Channel, ChannelGroup } from '../../types';

export default function ChannelList() {
  const { currentWorkspace } = useWorkspaceStore();
  const { channels, currentChannel, setChannels, setCurrentChannel, addChannel, unreadCounts } = useChannelStore();
  const { toggleSidebar, openSearch, openDocumentModal } = useUIStore();
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'public' | 'private'>('public');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [newChannelGroup, setNewChannelGroup] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const [dmTargetEmail, setDmTargetEmail] = useState('');
  const [userStatuses, setUserStatuses] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<ChannelGroup[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [channelDetail, setChannelDetail] = useState<any>(null);
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTopicVal, setEditTopicVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDescVal, setEditDescVal] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [showPinned, setShowPinned] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadChannels();
      loadUserStatuses();
      loadGroups();
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { userId, status } = (e as CustomEvent).detail;
      setUserStatuses((prev) => ({ ...prev, [userId]: status }));
    };
    window.addEventListener('user:status-change', handler);

    // 监听来自 MessageArea 的频道详情打开事件
    const detailHandler = (e: Event) => {
      const ch = (e as CustomEvent).detail;
      if (ch) handleOpenDetail(ch);
    };
    window.addEventListener('channel:open-detail', detailHandler);

    return () => {
      window.removeEventListener('user:status-change', handler);
      window.removeEventListener('channel:open-detail', detailHandler);
    };
  }, []);

  const loadUserStatuses = async () => {
    if (!currentWorkspace) return;
    try {
      const members = await api.getWorkspaceMembers(currentWorkspace.id);
      const statusMap: Record<string, string> = {};
      members.forEach((m: any) => { statusMap[m.user.id] = m.user.status || 'offline'; });
      setUserStatuses(statusMap);
    } catch {}
  };

  const loadGroups = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getChannelGroups(currentWorkspace.id);
      setGroups(data);
    } catch {}
  };

  const loadChannels = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getChannels(currentWorkspace.id);
      setChannels(data);
      if (data.length > 0) {
        selectChannel(data[0]);
      } else {
        setCurrentChannel(null as any);
      }
    } catch (err) {
      console.error('加载频道失败:', err);
    }
  };

  const selectChannel = (channel: Channel) => {
    setCurrentChannel(channel);
    joinChannel(channel.id);
    loadMessages(channel.id);
    setShowDetail(false);
  };

  const loadMessages = async (channelId: string) => {
    try {
      const msgs = await api.getMessages(channelId);
      useChannelStore.getState().setMessages(msgs);
    } catch (err) {
      console.error('加载消息失败:', err);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentWorkspace) return;
    try {
      const ch = await api.createChannel({
        workspaceId: currentWorkspace.id,
        name: newChannelName.trim(),
        type: newChannelType,
        topic: newChannelTopic || undefined,
        groupId: newChannelGroup || undefined,
      });
      addChannel(ch);
      setShowNewChannel(false);
      setNewChannelName('');
      setNewChannelTopic('');
      setNewChannelGroup('');
      selectChannel(ch);
    } catch (err: any) {
      alert(err.message || '创建频道失败');
    }
  };

  const handleCreateDm = async () => {
    if (!dmTargetEmail.trim() || !currentWorkspace) return;
    try {
      const wsMembersData = await api.getWorkspaceMembers(currentWorkspace.id);
      const target = wsMembersData.find((m: any) => m.user?.email === dmTargetEmail.trim() || m.user?.username === dmTargetEmail.trim());
      if (!target) { alert('未找到该用户，请确认邮箱或用户名'); return; }
      const ch = await api.createDm(currentWorkspace.id, target.user.id);
      if (!channels.find((c) => c.id === ch.id)) addChannel(ch);
      selectChannel(ch);
      setShowNewDm(false);
      setDmTargetEmail('');
    } catch (err: any) {
      alert(err.message || '创建私信失败');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !currentWorkspace) return;
    try {
      await api.createChannelGroup({ workspaceId: currentWorkspace.id, name: newGroupName.trim() });
      loadGroups();
      setShowNewGroup(false);
      setNewGroupName('');
    } catch (err: any) {
      alert(err.message || '创建分组失败');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('确定删除该分组？分组下的频道将移至未分组')) return;
    try {
      await api.deleteChannelGroup(groupId);
      loadGroups();
      loadChannels();
    } catch (err: any) {
      alert(err.message || '删除分组失败');
    }
  };

  const handlePinChannel = async (ch: Channel) => {
    try {
      await api.pinChannel(ch.id);
      loadChannels();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleLeaveChannel = async (ch: Channel) => {
    if (!confirm(`确定离开 #${ch.name}？`)) return;
    try {
      await api.leaveChannel(ch.id);
      loadChannels();
    } catch (err: any) {
      alert(err.message || '离开失败');
    }
  };

  const handleOpenDetail = async (ch: Channel) => {
    try {
      const detail = await api.getChannel(ch.id);
      setChannelDetail(detail);
      setShowDetail(true);
      const pinned = await api.getPinnedMessages(ch.id);
      setPinnedMessages(pinned);
    } catch {}
  };

  const handleUpdateTopic = async () => {
    if (!currentChannel) return;
    try {
      await api.updateChannel(currentChannel.id, { topic: editTopicVal });
      setEditingTopic(false);
      loadChannels();
      handleOpenDetail(currentChannel);
    } catch (err: any) { alert(err.message || '更新失败'); }
  };

  const handleUpdateDesc = async () => {
    if (!currentChannel) return;
    try {
      await api.updateChannel(currentChannel.id, { description: editDescVal });
      setEditingDesc(false);
      loadChannels();
      handleOpenDetail(currentChannel);
    } catch (err: any) { alert(err.message || '更新失败'); }
  };

  const handleMoveChannel = async (channelId: string, groupId: string) => {
    try {
      await api.updateChannel(channelId, { groupId: groupId || '' });
      loadChannels();
    } catch (err: any) { alert(err.message || '移动失败'); }
  };

  const handleUpdateNotifyPref = async (pref: string) => {
    if (!currentChannel) return;
    try {
      await api.updateNotifyPreference(currentChannel.id, pref as any);
      loadChannels();
      handleOpenDetail(currentChannel);
    } catch (err: any) { alert(err.message || '设置失败'); }
  };

  const handleMute = async (duration: string) => {
    if (!currentChannel) return;
    try {
      await api.muteChannel(currentChannel.id, duration as any);
      loadChannels();
      handleOpenDetail(currentChannel);
    } catch (err: any) { alert(err.message || '操作失败'); }
  };

  // 分类频道
  const pinnedChannels = channels.filter((c) => (c as any).pinned && c.type !== 'dm');
  const dmChannels = channels.filter((c) => c.type === 'dm');

  // 非置顶、非 DM 频道按分组归类
  const nonPinnedNonDm = channels.filter((c) => !(c as any).pinned && c.type !== 'dm');
  const groupedChannels: Record<string, Channel[]> = {};
  const ungrouped: Channel[] = [];
  nonPinnedNonDm.forEach((ch) => {
    const gid = ch.groupId || (ch as any).group?.id;
    if (gid) {
      if (!groupedChannels[gid]) groupedChannels[gid] = [];
      groupedChannels[gid].push(ch);
    } else {
      ungrouped.push(ch);
    }
  });

  const publicUngrouped = ungrouped.filter((c) => c.type === 'public');
  const privateUngrouped = ungrouped.filter((c) => c.type === 'private');

  const renderChannelItem = (ch: Channel, icon: string) => {
    const unread = unreadCounts[ch.id] || 0;
    const isPinned = (ch as any).pinned;
    const isMuted = (ch as any).muted;
    return (
      <div key={ch.id} className="group/ch relative">
        <button
          onClick={() => selectChannel(ch)}
          className={`w-full text-left px-3 py-1 rounded text-sm flex items-center gap-1.5 transition-colors ${
            currentChannel?.id === ch.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {isPinned && <span className="text-[10px] text-yellow-500">📌</span>}
          {isMuted && <span className="text-[10px] opacity-60">🔕</span>}
          <span className={currentChannel?.id === ch.id ? 'text-white/70' : 'text-gray-400'}>{icon}</span>
          <span className={`truncate flex-1 ${isMuted ? 'opacity-60' : ''}`}>{ch.name}</span>
          {unread > 0 && !isMuted && (
            <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center flex-shrink-0">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          {unread > 0 && isMuted && (
            <span className="bg-gray-400 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center flex-shrink-0">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        {/* 右键菜单式操作 */}
        <div className="hidden group-hover/sh:flex absolute right-1 top-1/2 -translate-y-1/2 items-center gap-0.5 bg-white rounded shadow-sm border border-gray-200 z-10">
          <button onClick={(e) => { e.stopPropagation(); handlePinChannel(ch); }} className="px-1 py-0.5 text-xs hover:bg-gray-100 rounded" title={isPinned ? '取消置顶' : '置顶'}>
            📌
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleOpenDetail(ch); }} className="px-1 py-0.5 text-xs hover:bg-gray-100 rounded" title="详情">
            ℹ️
          </button>
          {ch.type !== 'dm' && (
            <button onClick={(e) => { e.stopPropagation(); handleLeaveChannel(ch); }} className="px-1 py-0.5 text-xs hover:bg-red-50 text-red-500 rounded" title="离开">
              ✕
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base truncate">{currentWorkspace?.name || '工作区'}</h2>
          <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-600 p-1">◀</button>
        </div>
        <button onClick={openSearch} className="mt-2 w-full px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-500 text-left hover:bg-gray-200 transition-colors">
          🔍 搜索
        </button>
        <button onClick={() => openDocumentModal()} className="mt-1 w-full px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-500 text-left hover:bg-gray-200 transition-colors">
          📄 文档
        </button>
      </div>

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* 置顶频道 */}
        {pinnedChannels.length > 0 && (
          <div className="mb-3">
            <div className="px-2 py-1">
              <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">📌 置顶</span>
            </div>
            {pinnedChannels.map((ch) => renderChannelItem(ch, ch.type === 'private' ? '🔒' : '#'))}
          </div>
        )}

        {/* 分组频道 */}
        {groups.map((g) => {
          const gChannels = groupedChannels[g.id] || [];
          if (gChannels.length === 0 && groups.length > 0) return null;
          return (
            <div key={g.id} className="mb-3">
              <div className="flex items-center justify-between px-2 py-1 group/g">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{g.name}</span>
                <button onClick={() => handleDeleteGroup(g.id)} className="hidden group-hover/g:block text-gray-400 hover:text-red-500 text-xs">✕</button>
              </div>
              {gChannels.map((ch) => renderChannelItem(ch, ch.type === 'private' ? '🔒' : '#'))}
            </div>
          );
        })}

        {/* 未分组公开频道 */}
        {publicUngrouped.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">公开频道</span>
              <button onClick={() => setShowNewChannel(true)} className="text-gray-400 hover:text-gray-600 text-sm">+</button>
            </div>
            {publicUngrouped.map((ch) => renderChannelItem(ch, '#'))}
          </div>
        )}

        {/* 未分组私有频道 */}
        {privateUngrouped.length > 0 && (
          <div className="mb-3">
            <div className="px-2 py-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">私有频道</span>
            </div>
            {privateUngrouped.map((ch) => renderChannelItem(ch, '🔒'))}
          </div>
        )}

        {/* 分组管理按钮 */}
        <div className="mb-3 px-2">
          <button onClick={() => setShowNewGroup(true)} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">+ 新建分组</button>
        </div>

        {/* 私信 */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">私信</span>
            <button onClick={() => setShowNewDm(true)} className="text-gray-400 hover:text-gray-600 text-sm">+</button>
          </div>
          {dmChannels.map((ch) => {
            const dmName = (ch as any).displayName || ch.name.replace(/^dm-[^-]+-/, '');
            const dmMember = (ch as any).members?.[0];
            const dmUserId = dmMember?.user?.id || '';
            const dmUserStatus = dmUserId ? (userStatuses[dmUserId] || dmMember?.user?.status || 'offline') : 'offline';
            const isOnline = dmUserStatus === 'online';
            const unread = unreadCounts[ch.id] || 0;
            return (
              <button
                key={ch.id}
                onClick={() => selectChannel(ch)}
                className={`w-full text-left px-3 py-1 rounded text-sm flex items-center gap-1.5 transition-colors ${
                  currentChannel?.id === ch.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="truncate flex-1">{dmName}</span>
                {unread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center flex-shrink-0">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 新建频道弹窗 */}
      {showNewChannel && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-bold text-lg mb-4">创建频道</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">频道类型</label>
              <div className="flex gap-2">
                <button onClick={() => setNewChannelType('public')} className={`flex-1 py-2 rounded-md text-sm border ${newChannelType === 'public' ? 'border-primary bg-purple-50 text-primary' : 'border-gray-300 text-gray-600'}`}># 公开</button>
                <button onClick={() => setNewChannelType('private')} className={`flex-1 py-2 rounded-md text-sm border ${newChannelType === 'private' ? 'border-primary bg-purple-50 text-primary' : 'border-gray-300 text-gray-600'}`}>🔒 私有</button>
              </div>
            </div>
            <input type="text" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-3" placeholder="频道名称" autoFocus />
            <input type="text" value={newChannelTopic} onChange={(e) => setNewChannelTopic(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-3" placeholder="主题（可选）" />
            <select value={newChannelGroup} onChange={(e) => setNewChannelGroup(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4 text-sm">
              <option value="">不分组</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => { setShowNewChannel(false); setNewChannelName(''); setNewChannelTopic(''); setNewChannelGroup(''); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleCreateChannel} className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建私信弹窗 */}
      {showNewDm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-bold text-lg mb-4">发起新私信</h3>
            <input type="text" value={dmTargetEmail} onChange={(e) => setDmTargetEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateDm()} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4" placeholder="输入对方邮箱或用户名" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewDm(false); setDmTargetEmail(''); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleCreateDm} className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light">发起</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建分组弹窗 */}
      {showNewGroup && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-bold text-lg mb-4">新建分组</h3>
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4" placeholder="分组名称" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewGroup(false); setNewGroupName(''); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleCreateGroup} className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 频道详情面板 */}
      {showDetail && channelDetail && (
        <div className="absolute inset-0 bg-white z-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>{channelDetail.type === 'private' ? '🔒' : '#'}</span>
                {channelDetail.name}
              </h3>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* 主题 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">主题</span>
                <button onClick={() => { setEditingTopic(true); setEditTopicVal(channelDetail.topic || ''); }} className="text-xs text-primary hover:underline">编辑</button>
              </div>
              {editingTopic ? (
                <div className="flex gap-2">
                  <input type="text" value={editTopicVal} onChange={(e) => setEditTopicVal(e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-info" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateTopic()} />
                  <button onClick={handleUpdateTopic} className="text-xs text-primary font-medium">保存</button>
                  <button onClick={() => setEditingTopic(false)} className="text-xs text-gray-500">取消</button>
                </div>
              ) : (
                <p className="text-sm text-gray-700">{channelDetail.topic || '无主题'}</p>
              )}
            </div>

            {/* 描述 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">描述</span>
                <button onClick={() => { setEditingDesc(true); setEditDescVal(channelDetail.description || ''); }} className="text-xs text-primary hover:underline">编辑</button>
              </div>
              {editingDesc ? (
                <div className="flex gap-2">
                  <input type="text" value={editDescVal} onChange={(e) => setEditDescVal(e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-info" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateDesc()} />
                  <button onClick={handleUpdateDesc} className="text-xs text-primary font-medium">保存</button>
                  <button onClick={() => setEditingDesc(false)} className="text-xs text-gray-500">取消</button>
                </div>
              ) : (
                <p className="text-sm text-gray-700">{channelDetail.description || '无描述'}</p>
              )}
            </div>

            {/* 分组 */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">分组</span>
              <select
                value={channelDetail.groupId || ''}
                onChange={(e) => { handleMoveChannel(channelDetail.id, e.target.value); handleOpenDetail(currentChannel!); }}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">未分组</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* 成员列表 */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-2">成员 ({channelDetail.members?.length || 0})</span>
              {(channelDetail.members || []).map((m: any) => (
                <div key={m.userId} className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-1">
                  <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                    {m.user?.displayName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="text-sm truncate">{m.user?.displayName || m.userId}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {m.role === 'admin' ? '管理员' : '成员'}
                  </span>
                </div>
              ))}
            </div>

            {/* 置顶消息 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">📌 置顶消息 ({pinnedMessages.length})</span>
                <button onClick={() => setShowPinned(!showPinned)} className="text-xs text-primary hover:underline">
                  {showPinned ? '收起' : '展开'}
                </button>
              </div>
              {showPinned && pinnedMessages.map((pm: any) => (
                <div key={pm.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-white font-bold text-[10px]">
                      {pm.message?.user?.displayName?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-xs font-medium">{pm.message?.user?.displayName}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 pl-7">{pm.message?.content?.slice(0, 100)}</p>
                </div>
              ))}
              {showPinned && pinnedMessages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">暂无置顶消息</p>
              )}
            </div>

            {/* 通知偏好 */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">通知偏好</span>
              <div className="flex gap-1">
                {(['all', 'mentions', 'none'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleUpdateNotifyPref(p)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                      (channelDetail.notifyPreference || 'all') === p
                        ? 'border-primary bg-purple-50 text-primary'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p === 'all' ? '全部消息' : p === 'mentions' ? '仅@提及' : '关闭'}
                  </button>
                ))}
              </div>
            </div>

            {/* 频道静音 */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">频道静音</span>
              {channelDetail.muted ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-1">
                    已静音{channelDetail.mutedUntil ? ` 至 ${new Date(channelDetail.mutedUntil).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <button onClick={() => handleMute('off')} className="text-xs text-primary hover:underline">取消静音</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button onClick={() => handleMute('1h')} className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">静音 1 小时</button>
                  <button onClick={() => handleMute('until_tomorrow')} className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">直到明天</button>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { handlePinChannel(currentChannel!); setShowDetail(false); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                {(currentChannel as any)?.pinned ? '取消置顶' : '📌 置顶频道'}
              </button>
              <button onClick={() => { handleLeaveChannel(currentChannel!); setShowDetail(false); }} className="flex-1 py-2 border border-red-300 text-red-500 rounded-md text-sm hover:bg-red-50">
                离开频道
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
