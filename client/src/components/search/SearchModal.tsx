import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useChannelStore } from '../../stores/channelStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { api } from '../../services/api';
import { formatTime, getInitial } from '../../lib/utils';

type SearchTab = 'messages' | 'files';
type FileFilter = 'all' | 'image' | 'pdf' | 'document';
type MsgType = 'all' | 'text' | 'file' | 'system';

const HISTORY_KEY = 'slack_search_history';
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(term: string) {
  const list = loadHistory().filter((t) => t !== term);
  list.unshift(term);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export default function SearchModal() {
  const { searchOpen, closeSearch } = useUIStore();
  const { channels, setCurrentChannel } = useChannelStore();
  const { currentWorkspace } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<SearchTab>('messages');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // 筛选条件
  const [filterChannel, setFilterChannel] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterType, setFilterType] = useState<MsgType>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setResults([]);
      setTab('messages');
      setFileFilter('all');
      setShowFilters(false);
      setFilterChannel('');
      setFilterUser('');
      setFilterType('all');
      setFilterFrom('');
      setFilterTo('');
      setHistory(loadHistory());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

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
        if (tab === 'messages') {
          const data = await api.search({
            q: query.trim(),
            workspaceId: currentWorkspace?.id,
            channelId: filterChannel || undefined,
            userId: filterUser || undefined,
            type: filterType !== 'all' ? filterType : undefined,
            from: filterFrom || undefined,
            to: filterTo || undefined,
          });
          setResults(data);
        } else {
          if (!currentWorkspace) return;
          const data = await api.searchFiles(query.trim(), currentWorkspace.id);
          const filtered = fileFilter === 'all' ? data : data.filter((f: any) => {
            if (fileFilter === 'image') return f.fileType?.startsWith('image/');
            if (fileFilter === 'pdf') return f.fileType === 'application/pdf';
            if (fileFilter === 'document') return f.fileType?.includes('word') || f.fileType?.startsWith('text/');
            return true;
          });
          setResults(filtered);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab, fileFilter, currentWorkspace?.id, filterChannel, filterUser, filterType, filterFrom, filterTo]);

  const jumpToMessage = async (msg: any) => {
    if (query.trim()) saveHistory(query.trim());
    if (msg.channel) {
      setCurrentChannel(msg.channel);
      try {
        const msgs = await api.getMessages(msg.channel.id);
        useChannelStore.getState().setMessages(msgs);
      } catch {}
    }
    closeSearch();
  };

  const jumpToFile = async (file: any) => {
    if (query.trim()) saveHistory(query.trim());
    if (file.channel) {
      setCurrentChannel(file.channel);
      try {
        const msgs = await api.getMessages(file.channel.id);
        useChannelStore.getState().setMessages(msgs);
      } catch {}
    }
    closeSearch();
  };

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const hasActiveFilters = filterChannel || filterUser || filterType !== 'all' || filterFrom || filterTo;

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/40" onClick={closeSearch} />

      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <span className="text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                saveHistory(query.trim());
                setHistory(loadHistory());
              }
            }}
            className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400"
            placeholder={tab === 'messages' ? '搜索消息...' : '搜索文件...'}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
          {tab === 'messages' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`text-xs px-2 py-1 rounded transition-colors ${showFilters || hasActiveFilters ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              title="高级筛选"
            >⚙ 筛选</button>
          )}
          <kbd className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setTab('messages'); setResults([]); setShowFilters(false); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'messages' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >消息</button>
          <button
            onClick={() => { setTab('files'); setResults([]); setShowFilters(false); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'files' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >文件</button>
        </div>

        {/* 高级筛选面板 */}
        {tab === 'messages' && showFilters && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
            <div className="flex gap-2">
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-info"
              >
                <option value="">所有频道</option>
                {channels.filter((c) => c.type !== 'dm').map((c) => (
                  <option key={c.id} value={c.id}># {c.name}</option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as MsgType)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-info"
              >
                <option value="all">所有类型</option>
                <option value="text">文本</option>
                <option value="file">文件</option>
                <option value="system">系统</option>
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="作者用户名/ID"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-info"
              />
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-info"
                title="开始日期"
              />
              <span className="text-xs text-gray-400">至</span>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-info"
                title="结束日期"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterChannel(''); setFilterUser(''); setFilterType('all'); setFilterFrom(''); setFilterTo(''); }}
                className="text-xs text-primary hover:underline"
              >清除筛选</button>
            )}
          </div>
        )}

        {/* 文件类型过滤 */}
        {tab === 'files' && query && (
          <div className="flex gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50">
            {(['all', 'image', 'pdf', 'document'] as FileFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFileFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  fileFilter === f ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {f === 'all' ? '全部' : f === 'image' ? '图片' : f === 'pdf' ? 'PDF' : '文档'}
              </button>
            ))}
          </div>
        )}

        {/* 搜索结果 / 搜索历史 */}
        <div className="max-h-80 overflow-y-auto">
          {/* 搜索历史（无查询时显示） */}
          {!query && tab === 'messages' && history.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">最近搜索</span>
                <button onClick={handleClearHistory} className="text-xs text-gray-400 hover:text-red-500">清除</button>
              </div>
              {history.map((term, i) => (
                <button
                  key={i}
                  onClick={() => handleHistoryClick(term)}
                  className="w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-600 flex items-center gap-2"
                >
                  <span className="text-gray-400">🕐</span>
                  <span className="flex-1 truncate">{term}</span>
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">搜索中...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              没有找到与 "<span className="text-gray-600">{query}</span>" 相关的{tab === 'messages' ? '消息' : '文件'}
            </div>
          )}

          {!loading && !query && tab === 'messages' && history.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              输入关键词搜索消息
            </div>
          )}

          {!loading && !query && tab === 'files' && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              输入关键词搜索文件
            </div>
          )}

          {tab === 'messages' ? results.map((msg) => (
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
                {msg.type === 'file' && <span className="text-xs text-gray-400">📎</span>}
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 pl-8">{msg.content}</p>
            </button>
          )) : results.map((file: any) => (
            <button
              key={file.id}
              onClick={() => jumpToFile(file)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">
                  {file.fileType?.startsWith('image/') ? '🖼️' : file.fileType === 'application/pdf' ? '📄' : '📎'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{file.fileName || '文件'}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{file.user?.displayName}</span>
                    {file.fileSize && <span>{(file.fileSize / 1024).toFixed(1)} KB</span>}
                    <span>{formatTime(file.createdAt)}</span>
                    {file.channel && <span className="bg-gray-100 px-1.5 py-0.5 rounded"># {file.channel.name}</span>}
                  </div>
                </div>
                <a
                  href={api.downloadFile(file.id)}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline flex-shrink-0"
                >下载</a>
              </div>
            </button>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>⏎ 搜索 · Esc 关闭</span>
          {tab === 'messages' && hasActiveFilters && (
            <span className="text-primary">筛选条件已应用</span>
          )}
        </div>
      </div>
    </div>
  );
}
