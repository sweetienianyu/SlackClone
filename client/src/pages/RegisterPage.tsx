import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.register(form);
      setAuth(res.token, res.refreshToken, res.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-dark">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2">SlackClone</h1>
          <p className="text-white/70">创建新账号</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-8 shadow-lg space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">邮箱地址</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">用户名</label>
            <input type="text" value={form.username} onChange={(e) => update('username', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info" placeholder="zhangsan" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">显示名称</label>
            <input type="text" value={form.displayName} onChange={(e) => update('displayName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info" placeholder="张三" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">密码</label>
            <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info" placeholder="至少6位" required minLength={6} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-2.5 rounded-md font-semibold hover:bg-primary-light transition-colors disabled:opacity-50">
            {loading ? '注册中...' : '注册'}
          </button>
          <p className="text-center text-sm text-gray-500">
            已有账号？{' '}
            <Link to="/login" className="text-info hover:underline font-medium">登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
