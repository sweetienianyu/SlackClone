import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

type Tab = 'overview' | 'members' | 'channels';

export default function AdminPanel() {
  const { adminPanelOpen, closeAdminPanel } = useUIStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getAdminStats(currentWorkspace.id);
      setStats(data);
    } catch (err: any) {
      if (err.message?.includes('403')) {
        alert('仅管理员可访问');
        closeAdminPanel();
      }
    }
  }, [currentWorkspace?.id]);

  const loadMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getAdminMembers(currentWorkspace.id);
      setMembers(data);
    } catch { /* ignore */ }
  }, [currentWorkspace?.id]);

  const loadChannels = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getAdminChannels(currentWorkspace.id);
      setChannels(data);
    } catch { /* ignore */ }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!adminPanelOpen) return;
    setLoading(true);
    Promise.all([loadStats(), loadMembers(), loadChannels()]).finally(() => setLoading(false));
  }, [adminPanelOpen, currentWorkspace?.id]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.updateMemberRole(currentWorkspace!.id, userId, role);
      loadMembers();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('确定移除该成员？')) return;
    try {
      await fetch(`/api/workspaces/${currentWorkspace!.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      loadMembers();
    } catch { /* ignore */ }
  };

  const handleDeleteChannel = async (channelId: string, name: string) => {
    if (!confirm(`确定删除频道 #${name}？此操作不可恢复！`)) return;
    try {
      await api.deleteAdminChannel(currentWorkspace!.id, channelId);
      loadChannels();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (!adminPanelOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={closeAdminPanel} />

      <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-800">⚙️ 管理后台</h2>
            <span className="text-xs text-gray-400">{currentWorkspace?.name}</span>
          </div>
          <button onClick={closeAdminPanel} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* 标签栏 */}
        <div className="flex border-b border-gray-200 px-6">
          {([
            { key: 'overview', label: '概览' },
            { key: 'members', label: '成员管理' },
            { key: 'channels', label: '频道管理' },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-12">加载中...</div>
          ) : tab === 'overview' ? (
            <div>
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon="👥" label="成员" value={stats?.members?.total || 0} sub={`活跃 ${stats?.members?.active || 0}`} />
                <StatCard icon="💬" label="消息" value={stats?.messages?.total || 0} sub={`7天 ${stats?.messages?.last7Days || 0}`} />
                <StatCard icon="📢" label="频道" value={stats?.channels?.total || 0} />
                <StatCard icon="📄" label="文档" value={stats?.documents?.total || 0} />
              </div>

              {/* 7 天消息趋势 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">最近 7 天消息趋势</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {stats?.dailyMessageStats?.length > 0 ? (
                    <div className="flex items-end justify-between gap-2 h-40">
                      {stats.dailyMessageStats.map((d: any) => {
                        const max = Math.max(...stats.dailyMessageStats.map((s: any) => s.count), 1);
                        const height = (d.count / max) * 100;
                        return (
                          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">{d.count}</span>
                            <div className="w-full bg-primary rounded-t" style={{ height: `${height}%`, minHeight: '2px' }} />
                            <span className="text-xs text-gray-400">{formatDate(d.date)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-8 text-sm">暂无数据</div>
                  )}
                </div>
              </div>

              {/* 频道活跃度排行 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">频道活跃度排行（近 7 天）</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {stats?.topChannels?.length > 0 ? (
                    <div className="space-y-2">
                      {stats.topChannels.map((ch: any, idx: number) => (
                        <div key={ch.id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                          <span className="text-sm text-gray-700 w-32 truncate">
                            {ch.type === 'dm' ? '🔒' : ch.type === 'private' ? '🔒' : '#'} {ch.name}
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full"
                              style={{ width: `${(ch.messageCount / Math.max(...stats.topChannels.map((c: any) => c.messageCount), 1)) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">{ch.messageCount} 条</span>
                          <span className="text-xs text-gray-400 w-16 text-right">{ch.memberCount} 人</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-8 text-sm">暂无数据</div>
                  )}
                </div>
              </div>

              {/* 存储用量 */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">存储用量</h3>
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{formatBytes(stats?.files?.storageBytes || 0)}</div>
                    <div className="text-xs text-gray-400">{stats?.files?.total || 0} 个文件</div>
                  </div>
                  <span className="text-3xl">📁</span>
                </div>
              </div>
            </div>
          ) : tab === 'members' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">成员列表（{members.length}）</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400">
                      <th className="text-left py-2 px-3">成员</th>
                      <th className="text-left py-2 px-3">邮箱</th>
                      <th className="text-left py-2 px-3">角色</th>
                      <th className="text-left py-2 px-3">消息数</th>
                      <th className="text-left py-2 px-3">加入时间</th>
                      <th className="text-left py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.userId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                              {(m.user?.displayName || m.user?.username || '?')[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800">{m.user?.displayName || m.user?.username}</span>
                            {m.userId === user?.id && <span className="text-xs text-gray-400">(你)</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-500">{m.user?.email}</td>
                        <td className="py-3 px-3">
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                            disabled={m.userId === user?.id}
                            className="text-xs border border-gray-200 rounded px-2 py-1 disabled:opacity-50"
                          >
                            <option value="admin">管理员</option>
                            <option value="member">成员</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-gray-500">{m.messageCount}</td>
                        <td className="py-3 px-3 text-gray-400 text-xs">{new Date(m.joinedAt).toLocaleDateString('zh-CN')}</td>
                        <td className="py-3 px-3">
                          {m.userId !== user?.id && m.role !== 'admin' && (
                            <button
                              onClick={() => handleRemoveMember(m.userId)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              移除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'channels' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">频道列表（{channels.length}）</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400">
                      <th className="text-left py-2 px-3">频道</th>
                      <th className="text-left py-2 px-3">类型</th>
                      <th className="text-left py-2 px-3">成员数</th>
                      <th className="text-left py-2 px-3">消息数</th>
                      <th className="text-left py-2 px-3">创建时间</th>
                      <th className="text-left py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch) => (
                      <tr key={ch.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <span className="font-medium text-gray-800">
                            {ch.type === 'dm' ? '🔒' : ch.type === 'private' ? '🔒' : '#'} {ch.name}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            ch.type === 'public' ? 'bg-green-100 text-green-700' :
                            ch.type === 'private' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {ch.type === 'public' ? '公开' : ch.type === 'private' ? '私有' : '私信'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-500">{ch._count?.members || 0}</td>
                        <td className="py-3 px-3 text-gray-500">{ch._count?.messages || 0}</td>
                        <td className="py-3 px-3 text-gray-400 text-xs">{new Date(ch.createdAt).toLocaleDateString('zh-CN')}</td>
                        <td className="py-3 px-3">
                          {ch.name !== 'general' ? (
                            <button
                              onClick={() => handleDeleteChannel(ch.id, ch.name)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              删除
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">默认频道</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      <span className="text-3xl">{icon}</span>
    </div>
  );
}
