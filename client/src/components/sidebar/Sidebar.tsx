import { useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import { getInitial } from '../../lib/utils';

const COLORS = ['#611f69', '#1264a3', '#0f7840', '#da2e38', '#ecb22e', '#e01e5a', '#4a154b'];

const STATUS_OPTIONS = [
  { value: 'online', label: '在线', color: 'bg-green-500', emoji: '🟢' },
  { value: 'away', label: '离开', color: 'bg-yellow-500', emoji: '🟡' },
  { value: 'busy', label: '忙碌', color: 'bg-red-500', emoji: '🔴' },
  { value: 'offline', label: '离线', color: 'bg-gray-400', emoji: '⚫' },
] as const;

export default function Sidebar() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, addWorkspace } = useWorkspaceStore();
  const { user, logout, setUser } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [wsName, setWsName] = useState('');

  // 个人资料编辑
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const handleCreate = async () => {
    if (!wsName.trim()) return;
    try {
      const ws = await api.createWorkspace({ name: wsName.trim() });
      addWorkspace(ws);
      setCurrentWorkspace(ws);
      setShowCreate(false);
      setWsName('');
    } catch (err: any) {
      alert(err.message || '创建工作区失败');
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!user) return;
    try {
      const updated = await api.updateProfile({ status });
      setUser(updated);
    } catch {
      setUser({ ...user, status: status as any });
    }
    setShowStatusMenu(false);
  };

  const openProfile = () => {
    if (!user) return;
    setEditDisplayName(user.displayName);
    setEditUsername(user.username);
    setEditStatus(user.status || 'online');
    setShowProfile(true);
    setShowStatusMenu(false);
  };

  const handleSaveProfile = async () => {
    try {
      const updated = await api.updateProfile({
        displayName: editDisplayName.trim() || undefined,
        username: editUsername.trim() || undefined,
        status: editStatus,
      });
      setUser(updated);
      setShowProfile(false);
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === user?.status) || STATUS_OPTIONS[0];

  return (
    <>
      <div className="w-16 flex-shrink-0 bg-primary-dark flex flex-col items-center py-4 gap-3">
        {/* 工作区图标列表 */}
        {workspaces.map((ws, i) => (
          <button
            key={ws.id}
            onClick={() => setCurrentWorkspace(ws)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm transition-all hover:rounded-xl ${
              currentWorkspace?.id === ws.id ? 'bg-white/30 rounded-xl' : 'bg-white/10 hover:bg-white/20'
            }`}
            style={{ backgroundColor: currentWorkspace?.id === ws.id ? undefined : COLORS[i % COLORS.length] }}
            title={ws.name}
          >
            {ws.name.charAt(0).toUpperCase()}
          </button>
        ))}

        {/* 新建工作区按钮 */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-10 h-10 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:text-white hover:border-white/60 transition-colors"
          title="新建工作区"
        >
          +
        </button>

        {/* 底部用户头像 + 状态 */}
        <div className="mt-auto relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="relative w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold text-sm hover:bg-white/20 transition-colors"
            title={`${user?.displayName} - ${currentStatus.label}`}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded" />
            ) : (
              user ? getInitial(user.displayName) : '?'
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-primary-dark ${currentStatus.color}`} />
          </button>

          {/* 状态菜单 */}
          {showStatusMenu && (
            <div className="absolute bottom-12 left-14 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800 truncate">{user?.displayName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                    user?.status === opt.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                  <span>{opt.label}</span>
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={openProfile}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ✏️ 编辑个人资料
                </button>
                <button
                  onClick={() => { setShowStatusMenu(false); logout(); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 创建工作区弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-bold text-lg mb-4">创建新工作区</h3>
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4"
              placeholder="工作区名称"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setWsName(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 个人资料编辑弹窗 */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="font-bold text-lg mb-4">编辑个人资料</h3>

            {/* 头像预览 */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-2xl">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-lg" />
                ) : (
                  getInitial(user?.displayName || '?')
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">头像</p>
                <p className="text-xs text-gray-400">暂不支持上传，可输入 URL</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">头像 URL</label>
                <input
                  type="text"
                  value={user?.avatarUrl || ''}
                  onChange={(e) => setUser({ ...user!, avatarUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowProfile(false)}
                className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-light"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
