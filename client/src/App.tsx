import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';

function App() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => (s as any)._hasHydrated);

  // 等待 persist hydration 完成，避免 token 闪烁导致误跳转
  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to="/" />} />
      <Route path="/*" element={token ? <WorkspacePage /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
