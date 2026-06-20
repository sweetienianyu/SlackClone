import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useChannelStore } from '../../stores/channelStore';
import { api } from '../../services/api';
import { getSocket } from '../../lib/socket';
import { formatTime } from '../../lib/utils';

const FALLBACK_TEMPLATES = [
  { key: 'blank', title: '空白文档', icon: '📄', description: '从零开始的空白文档', category: '基础' },
  { key: 'meeting', title: '会议纪要', icon: '📝', description: '记录会议讨论、决议和待办事项', category: '会议' },
  { key: 'plan', title: '项目计划', icon: '📊', description: '项目规划、里程碑和风险管理', category: '项目管理' },
  { key: 'retro', title: '回顾总结', icon: '🔄', description: '团队迭代回顾与总结', category: '团队' },
  { key: 'weekly', title: '周报', icon: '📅', description: '个人工作周报模板', category: '汇报' },
  { key: 'requirement', title: '需求文档', icon: '📋', description: '产品需求文档（PRD）模板', category: '产品' },
  { key: 'onboarding', title: '新人入职指南', icon: '👋', description: '新人入职流程与指引', category: '团队' },
  { key: 'brainstorm', title: '头脑风暴', icon: '💡', description: '创意头脑风暴与想法评估', category: '团队' },
  { key: 'api', title: 'API 设计文档', icon: '🔌', description: 'API 接口设计文档模板', category: '技术' },
  { key: 'decision', title: '决策记录', icon: '⚖️', description: '架构决策记录（ADR）', category: '技术' },
];

export default function DocumentModal() {
  const { documentModalOpen, documentId, closeDocumentModal } = useUIStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { currentChannel } = useChannelStore();

  const [view, setView] = useState<'list' | 'editor' | 'create'>(documentId ? 'editor' : 'list');
  const [docs, setDocs] = useState<any[]>([]);
  const [currentDoc, setCurrentDoc] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<any[]>(FALLBACK_TEMPLATES);
  const [templateCategories, setTemplateCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const isRemoteUpdate = useRef(false);

  // 加载文档列表
  const loadDocs = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const data = await api.getDocuments(currentWorkspace.id, currentChannel?.id);
      setDocs(data);
    } catch { setDocs([]); } finally { setLoading(false); }
  }, [currentWorkspace?.id, currentChannel?.id]);

  // 打开时初始化
  useEffect(() => {
    if (!documentModalOpen) return;
    if (documentId) {
      setView('editor');
      loadDoc(documentId);
    } else {
      setView('list');
      loadDocs();
    }
    // 加载模板列表
    api.getDocumentTemplates().then((data) => {
      setTemplates(data.templates);
      setTemplateCategories(data.categories);
    }).catch(() => {
      setTemplates(FALLBACK_TEMPLATES);
    });
  }, [documentModalOpen, documentId]);

  // ESC 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && documentModalOpen) closeDocumentModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [documentModalOpen]);

  const loadDoc = async (id: string) => {
    try {
      const doc = await api.getDocument(id);
      setCurrentDoc(doc);
      setTitle(doc.title);
      setContent(doc.content);
      // 加入文档协作房间
      const socket = getSocket();
      socket?.emit('document:join', id);
    } catch { /* ignore */ }
  };

  // 监听文档实时更新
  useEffect(() => {
    if (view !== 'editor' || !currentDoc) return;
    const socket = getSocket();

    const handleUpdate = (data: any) => {
      if (data.id === currentDoc.id) {
        isRemoteUpdate.current = true;
        if (data.title !== undefined) setTitle(data.title);
        if (data.content !== undefined) {
          setContent(data.content);
          // 保持光标位置
          const pos = contentRef.current?.selectionStart;
          if (pos !== undefined && contentRef.current) {
            setTimeout(() => {
              contentRef.current?.setSelectionRange(pos, pos);
            }, 0);
          }
        }
        setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      }
    };

    const handleEdit = (data: any) => {
      isRemoteUpdate.current = true;
      if (data.title !== undefined) setTitle(data.title);
      if (data.content !== undefined) {
        setContent(data.content);
        const pos = contentRef.current?.selectionStart;
        if (pos !== undefined && contentRef.current) {
          setTimeout(() => contentRef.current?.setSelectionRange(pos, pos), 0);
        }
      }
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
    };

    const handleUserJoined = (data: any) => {
      setActiveUsers((prev) => prev.some((u) => u.userId === data.userId) ? prev : [...prev, data]);
    };

    const handleUserLeft = (data: any) => {
      setActiveUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    };

    socket?.on('document:update', handleUpdate);
    socket?.on('document:edit', handleEdit);
    socket?.on('document:user-joined', handleUserJoined);
    socket?.on('document:user-left', handleUserLeft);

    return () => {
      socket?.off('document:update', handleUpdate);
      socket?.off('document:edit', handleEdit);
      socket?.off('document:user-joined', handleUserJoined);
      socket?.off('document:user-left', handleUserLeft);
      socket?.emit('document:leave', currentDoc.id);
    };
  }, [view, currentDoc?.id]);

  // 自动保存（防抖）
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (isRemoteUpdate.current) return;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!currentDoc) return;
      try {
        await api.updateDocument(currentDoc.id, { content: newContent });
        // 广播给其他协作者
        const socket = getSocket();
        socket?.emit('document:edit', { docId: currentDoc.id, content: newContent });
      } catch { /* ignore */ }
    }, 800);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (isRemoteUpdate.current) return;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!currentDoc) return;
      try {
        await api.updateDocument(currentDoc.id, { title: newTitle });
        const socket = getSocket();
        socket?.emit('document:edit', { docId: currentDoc.id, title: newTitle });
      } catch { /* ignore */ }
    }, 800);
  };

  const handleCreateDoc = async (template: string) => {
    if (!currentWorkspace) return;
    try {
      const doc = await api.createDocument({
        workspaceId: currentWorkspace.id,
        title: '',
        template,
        channelId: currentChannel?.id,
      });
      setCurrentDoc(doc);
      setTitle(doc.title);
      setContent(doc.content);
      setView('editor');
      setShowTemplatePicker(false);
      const socket = getSocket();
      socket?.emit('document:join', doc.id);
    } catch (err: any) {
      alert(err.message || '创建失败');
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('确定删除此文档？')) return;
    try {
      await api.deleteDocument(id);
      loadDocs();
    } catch { /* ignore */ }
  };

  const handleShareToChannel = async () => {
    if (!currentDoc || !currentChannel) return;
    try {
      await api.sendMessage({
        channelId: currentChannel.id,
        content: `📄 文档卡片: [${title || '无标题'}] (doc:${currentDoc.id})`,
      });
      closeDocumentModal();
    } catch { /* ignore */ }
  };

  if (!documentModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={closeDocumentModal} />

      <div className="relative w-full max-w-3xl h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button onClick={() => { setView('list'); loadDocs(); }} className="text-gray-400 hover:text-gray-600 text-sm">← 返回</button>
            )}
            <h2 className="text-sm font-semibold text-gray-800">
              {view === 'list' ? '📄 文档' : view === 'create' ? '新建文档' : '编辑文档'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === 'editor' && activeUsers.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {activeUsers.length} 人协作中
              </div>
            )}
            {view === 'editor' && (
              <button onClick={handleShareToChannel} className="text-xs text-primary hover:underline">分享到频道</button>
            )}
            <button onClick={closeDocumentModal} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {/* 文档列表 */}
          {view === 'list' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500">{docs.length} 个文档</span>
                <button onClick={() => setShowTemplatePicker(!showTemplatePicker)} className="text-xs px-3 py-1.5 bg-primary text-white rounded hover:opacity-90">
                  + 新建文档
                </button>
              </div>

              {/* 模板选择器 */}
              {showTemplatePicker && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">选择模板</h3>
                    <button onClick={() => { setShowTemplatePicker(false); setPreviewTemplate(null); }} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                  </div>

                  {/* 分类筛选 */}
                  {templateCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      <button
                        onClick={() => setActiveCategory('全部')}
                        className={`text-xs px-2 py-1 rounded ${activeCategory === '全部' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                      >
                        全部
                      </button>
                      {templateCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`text-xs px-2 py-1 rounded ${activeCategory === cat ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {templates
                      .filter((t) => activeCategory === '全部' || t.category === activeCategory)
                      .map((t) => (
                        <div
                          key={t.key}
                          className={`relative p-3 bg-white border rounded-lg hover:shadow-sm transition-all cursor-pointer ${
                            previewTemplate === t.key ? 'border-primary shadow-sm' : 'border-gray-200 hover:border-primary'
                          }`}
                          onClick={() => setPreviewTemplate(t.key)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-2xl">{t.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800">{t.title}</div>
                              <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</div>
                              <span className="inline-block mt-1 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.category}</span>
                            </div>
                          </div>
                          {previewTemplate === t.key && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <pre className="text-[10px] text-gray-500 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono">{t.preview}</pre>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCreateDoc(t.key); }}
                                className="mt-2 w-full text-xs py-1.5 bg-primary text-white rounded hover:opacity-90"
                              >
                                使用此模板
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center text-gray-400 py-8 text-sm">加载中...</div>
              ) : docs.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">
                  暂无文档，点击「新建文档」创建
                </div>
              ) : (
                docs.map((doc) => (
                  <div key={doc.id} className="group flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                    <span className="text-2xl">📄</span>
                    <button onClick={() => { loadDoc(doc.id); setView('editor'); }} className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-800">{doc.title || '无标题'}</div>
                      <div className="text-xs text-gray-400">
                        {doc.creator?.displayName} · {formatTime(doc.updatedAt)}
                        {doc.channel && <span className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded"># {doc.channel.name}</span>}
                      </div>
                    </button>
                    <button onClick={() => handleDeleteDoc(doc.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600">删除</button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 文档编辑器 */}
          {view === 'editor' && currentDoc && (
            <div className="p-6">
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="文档标题"
                className="w-full text-2xl font-bold text-gray-800 outline-none mb-4 placeholder-gray-300"
              />
              <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                <span>由 {currentDoc.creator?.displayName} 创建</span>
                <span>·</span>
                <span>{formatTime(currentDoc.createdAt)}</span>
                {currentDoc.channel && (
                  <>
                    <span>·</span>
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded"># {currentDoc.channel.name}</span>
                  </>
                )}
              </div>
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="开始编辑... 支持 Markdown 语法"
                className="w-full min-h-[50vh] text-sm text-gray-700 outline-none resize-none font-mono leading-relaxed"
              />
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                💡 支持 Markdown：# 标题、- 列表、```代码块```、| 表格 |、- [ ] 待办
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
