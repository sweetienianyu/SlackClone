import { useEffect, useState, useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useChannelStore } from '../../stores/channelStore';
import { api } from '../../services/api';
import { formatTime, getInitial } from '../../lib/utils';
import { emitThreadClose } from '../../lib/socket';

const AVATAR_COLORS = ['#611f69', '#1264a3', '#0f7840', '#da2e38', '#ecb22e', '#e01e5a'];

export default function ThreadPanel() {
  const { threadPanelOpen, threadParentId, closeThread } = useUIStore();

  const handleClose = () => {
    closeThread();
    emitThreadClose();
  };
  const { messages } = useChannelStore();
  const [replies, setReplies] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const parentMsg = messages.find((m) => m.id === threadParentId);

  useEffect(() => {
    if (threadParentId) loadReplies();
  }, [threadParentId]);

  // 监听线程新回复事件，实时追加
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail.parentId === threadParentId) {
        setReplies((prev) => [...prev, e.detail.reply]);
      }
    };
    window.addEventListener('thread:new-reply', handler as EventListener);
    return () => window.removeEventListener('thread:new-reply', handler as EventListener);
  }, [threadParentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const loadReplies = async () => {
    if (!threadParentId) return;
    try {
      const data = await api.getThread(threadParentId);
      setReplies(data);
    } catch (err) {
      console.error('加载线程失败:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !threadParentId || sending) return;
    setSending(true);
    try {
      await api.sendMessage({
        channelId: parentMsg?.channelId || '',
        content: input.trim(),
        parentId: threadParentId,
      });
      setInput('');
      loadReplies();
    } catch (err: any) {
      alert(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  if (!threadPanelOpen || !parentMsg) return null;

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
      {/* 头部 */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
        <h3 className="font-bold text-sm">线程</h3>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">✕</button>
      </div>

      {/* 原始消息 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <div
            className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: AVATAR_COLORS[parseInt(parentMsg.userId) % AVATAR_COLORS.length] || '#611f69' }}
          >
            {parentMsg.user ? getInitial(parentMsg.user.displayName) : getInitial(parentMsg.userId)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm">{parentMsg.user?.displayName || parentMsg.userId}</span>
              <span className="text-xs text-gray-400">{formatTime(parentMsg.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-800 break-words whitespace-pre-wrap mt-0.5">{parentMsg.content}</p>
          </div>
        </div>
      </div>

      {/* 回复列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {replies.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">还没有回复</p>
        )}
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-2 py-2">
            <div
              className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
              style={{ backgroundColor: AVATAR_COLORS[parseInt(reply.userId) % AVATAR_COLORS.length] || '#611f69' }}
            >
              {reply.user ? getInitial(reply.user.displayName) : getInitial(reply.userId)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-xs">{reply.user?.displayName || reply.userId}</span>
                <span className="text-xs text-gray-400">{formatTime(reply.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{reply.content}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* 回复输入框 */}
      <div className="px-3 pb-3">
        <div className="border border-gray-300 rounded-lg bg-white focus-within:border-info focus-within:ring-1 focus-within:ring-info">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="w-full px-3 py-2 text-sm resize-none outline-none min-h-[36px] max-h-[120px]"
            placeholder="回复..."
            rows={1}
          />
          <div className="flex justify-end px-2 py-1">
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="text-primary hover:text-primary-light disabled:text-gray-300 text-sm"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
