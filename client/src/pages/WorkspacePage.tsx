import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { connectSocket } from '../lib/socket';
import AppLayout from '../components/layout/AppLayout';

export default function WorkspacePage() {
  const { currentWorkspace, setWorkspaces, setCurrentWorkspace, addWorkspace } = useWorkspaceStore();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [wsName, setWsName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    loadWorkspaces();
    connectSocket();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoadError('');
      const data = await api.getWorkspaces();
      setWorkspaces(data);
      if (data.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(data[0]);
      }
    } catch (err: any) {
      console.error('加载工作区失败:', err);
      setLoadError(err.message || '加载工作区失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!wsName.trim()) return;
    try {
      const ws = await api.createWorkspace({ name: wsName.trim() });
      addWorkspace(ws);
      setCurrentWorkspace(ws);
      setWsName('');
    } catch (err: any) {
      alert(err.message || '创建失败');
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setJoinError('');
    try {
      const ws = await api.joinWorkspace(inviteCode.trim());
      addWorkspace(ws);
      setCurrentWorkspace(ws);
      setInviteCode('');
    } catch (err: any) {
      setJoinError(err.message || '加入失败');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500 text-lg">加载中...</div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="h-screen flex items-center justify-center bg-primary-dark">
        <div className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2">欢迎, {user?.displayName}</h1>
            <p className="text-white/70">创建或加入一个工作区开始协作</p>
          </div>

          {/* 创建工作区 */}
          <div className="bg-white rounded-lg p-8 shadow-lg mb-4">
            <h3 className="font-bold text-lg mb-4">创建新工作区</h3>
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info mb-4"
              placeholder="工作区名称"
            />
            <button
              onClick={handleCreate}
              className="w-full bg-primary text-white py-2.5 rounded-md font-semibold hover:bg-primary-light transition-colors"
            >
              创建工作区
            </button>
          </div>

          {/* 通过邀请码加入 */}
          <div className="bg-white/10 rounded-lg p-6 border border-white/20">
            <h3 className="font-bold text-white text-lg mb-2">加入已有工作区</h3>
            <p className="text-white/70 text-sm mb-3">
              输入工作区管理员分享的邀请码即可加入
            </p>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="w-full px-3 py-2 border border-white/30 rounded-md bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 mb-2"
              placeholder="输入邀请码"
            />
            {joinError && <p className="text-red-300 text-sm mb-2">{joinError}</p>}
            <button
              onClick={handleJoin}
              className="w-full py-2 border border-white/30 text-white rounded-md text-sm hover:bg-white/10 transition-colors"
            >
              加入工作区
            </button>
          </div>

          {/* 错误提示与操作 */}
          {loadError && (
            <div className="mt-4 bg-red-500/20 border border-red-400/30 rounded-lg p-4">
              <p className="text-red-200 text-sm mb-3">{loadError}</p>
              <button
                onClick={loadWorkspaces}
                className="w-full py-2 bg-white/10 text-white rounded-md text-sm hover:bg-white/20 transition-colors mb-2"
              >
                重新加载
              </button>
            </div>
          )}

          {/* 退出登录 */}
          <div className="mt-4 text-center">
            <button
              onClick={logout}
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              退出登录 ({user?.email})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}
