import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useChannelStore } from '../../stores/channelStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { api } from '../../services/api';
import { formatTime, getInitial } from '../../lib/utils';

type SearchTab = 'messages' | 'files';
type FileFilter = 'all' | 'image' | 'pdf' | 'document';

export default function SearchModal() {
  const { searchOpen, closeSearch } = useUIStore();
  const { setCurrentChannel } = useChannelStore();
  const { currentWorkspace } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<SearchTab>('messages');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setResults([]);
      setTab('messages');
      setFileFilter('all');
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
          const data = await api.search(query.trim());
          setResults(data);
        } else {
          if (!currentWorkspace) return;
          const data = await api.searchFiles(query.trim(), currentWorkspace.id);
          // 客户端按类型过滤
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
  }, [query, tab, fileFilter, currentWorkspace?.id]);

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

  const jumpToFile = async (file: any) => {
    if (file.channel) {
      setCurrentChannel(file.channel);
      try {
        const msgs = await api.getMessages(file.channel.id);
        useChannelStore.getState().setMessages(msgs);
      } catch {}
    }
    closeSearch();
  };

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
            className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400"
            placeholder={tab === 'messages' ? '搜索消息...' : '搜索文件...'}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
          <kbd className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setTab('messages'); setResults([]); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'messages' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >消息</button>
          <button
            onClick={() => { setTab('files'); setResults([]); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'files' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >文件</button>
        </div>

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

        {/* 搜索结果 */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">搜索中...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              没有找到与 "<span className="text-gray-600">{query}</span>" 相关的{tab === 'messages' ? '消息' : '文件'}
            </div>
          )}

          {!loading && !query && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              输入关键词搜索{tab === 'messages' ? '消息' : '文件'}
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
      </div>
    </div>
  );
}
