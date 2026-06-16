import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useChannelStore } from '../../stores/channelStore';
import { api } from '../../services/api';
import { formatTime, getInitial } from '../../lib/utils';

export default function SearchModal() {
  const { searchOpen, closeSearch } = useUIStore();
  const { setCurrentChannel } = useChannelStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Esc 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchOpen) closeSearch();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [searchOpen]);

  // 防抖搜索
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const jumpToMessage = async (msg: any) => {
    if (msg.channel) {
      const { setCurrentChannel } = useChannelStore.getState();
      setCurrentChannel(msg.channel);
      try {
        const msgs = await api.getMessages(msg.channel.id);
        useChannelStore.getState().setMessages(msgs);
      } catch {}
    }
    closeSearch();
  };

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={closeSearch} />

      {/* 搜索面板 */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <span className="text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400"
            placeholder="搜索消息、频道..."
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-sm">
              ✕
            </button>
          )}
          <kbd className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* 搜索结果 */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">搜索中...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              没有找到与 "<span className="text-gray-600">{query}</span>" 相关的结果
            </div>
          )}

          {!loading && !query && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              输入关键词搜索消息
            </div>
          )}

          {results.map((msg) => (
            <button
              key={msg.id}
              onClick={() => jumpToMessage(msg)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: '#611f69' }}
                >
                  {msg.user ? getInitial(msg.user.displayName) : '?'}
                </div>
                <span className="text-sm font-semibold text-gray-800">{msg.user?.displayName}</span>
                <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                {msg.channel && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    # {msg.channel.name}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 pl-8">
                {msg.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
