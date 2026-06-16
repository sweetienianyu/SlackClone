import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useChannelStore } from '../../stores/channelStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import { joinChannel } from '../../lib/socket';
import type { Channel } from '../../types';

export default function ChannelList() {
  const { currentWorkspace } = useWorkspaceStore();
  const { channels, currentChannel, setChannels, setCurrentChannel, addChannel } = useChannelStore();
  const { toggleSidebar, openSearch } = useUIStore();
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'public' | 'private'>('public');
  const [showNewDm, setShowNewDm] = useState(false);
  const [dmTargetEmail, setDmTargetEmail] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      loadChannels();
    }
  }, [currentWorkspace?.id]);

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
      });
      addChannel(ch);
      setShowNewChannel(false);
      setNewChannelName('');
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
      if (!target) {
        alert('未找到该用户，请确认邮箱或用户名');
        return;
      }
      const ch = await api.createDm(currentWorkspace.id, target.user.id);
      if (!channels.find((c) => c.id === ch.id)) {
        addChannel(ch);
      }
      selectChannel(ch);
      setShowNewDm(false);
      setDmTargetEmail('');
    } catch (err: any) {
      alert(err.message || '创建私信失败');
    }
  };

  const publicChannels = channels.filter((c) => c.type === 'public');
  const privateChannels = channels.filter((c) => c.type === 'private');
  const dmChannels = channels.filter((c) => c.type === 'dm');

  return (
    <div className="h-full flex flex-col relative">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base truncate">{currentWorkspace?.name || '工作区'}</h2>
          <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-600 p-1">◀</button>
        </div>
        <button
          onClick={openSearch}
          className="mt-2 w-full px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-500 text-left hover:bg-gray-200 transition-colors"
        >
          🔍 搜索
        </button>
      </div>

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* 公开频道 */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">公开频道</span>
            <button onClick={() => setShowNewChannel(true)} className="text-gray-400 hover:text-gray-600 text-sm">+</button>
          </div>
          {publicChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => selectChannel(ch)}
              className={`w-full text-left px-3 py-1 rounded text-sm flex items-center gap-1.5 transition-colors ${
                currentChannel?.id === ch.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className={currentChannel?.id === ch.id ? 'text-white/70' : 'text-gray-400'}>#</span>
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>

        {/* 私有频道 */}
        {privateChannels.length > 0 && (
          <div className="mb-3">
            <div className="px-2 py-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">私有频道</span>
            </div>
            {privateChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => selectChannel(ch)}
                className={`w-full text-left px-3 py-1 rounded text-sm flex items-center gap-1.5 transition-colors ${
                  currentChannel?.id === ch.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className={currentChannel?.id === ch.id ? 'text-white/70' : 'text-gray-400'}>🔒</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 私信 */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">私信</span>
            <button onClick={() => setShowNewDm(true)} className="text-gray-400 hover:text-gray-600 text-sm">+</button>
          </div>
          {dmChannels.map((ch) => {
            const dmName = (ch as any).displayName || ch.name.replace(/^dm-[^-]+-/, '');
            return (
              <button
                key={ch.id}
                onClick={() => selectChannel(ch)}
                className={`w-full text-left px-3 py-1 rounded text-sm flex items-center gap-1.5 transition-colors ${
                  currentChannel?.id === ch.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="truncate">{dmName}</span>
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
                <button
                  onClick={() => setNewChannelType('public')}
                  className={`flex-1 py-2 rounded-md text-sm border ${
                    newChannelType === 'public' ? 'border-primary bg-purple-50 text-primary' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  # 公开
                </button>
                <button
                  onClick={() => setNewChannelType('private')}
                  className={`flex-1 py-2 rounded-md text-sm border ${
                    newChannelType === 'private' ? 'border-primary bg-purple-50 text-primary' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  🔒 私有
                </button>
              </div>
            </div>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4"
              placeholder="频道名称"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewChannel(false); setNewChannelName(''); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">取消</button>
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
            <input
              type="text"
              value={dmTargetEmail}
              onChange={(e) => setDmTargetEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDm()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4"
              placeholder="输入对方邮箱或用户名"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewDm(false); setDmTargetEmail(''); }} className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleCreateDm} className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light">发起</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
