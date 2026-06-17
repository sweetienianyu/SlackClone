import { useEffect } from 'react';
import Sidebar from '../sidebar/Sidebar';
import ChannelList from '../channel-list/ChannelList';
import MessageArea from '../message-area/MessageArea';
import ThreadPanel from '../message-area/ThreadPanel';
import SearchModal from '../search/SearchModal';
import DocumentModal from '../document/DocumentModal';
import { useUIStore } from '../../stores/uiStore';

export default function AppLayout() {
  const { sidebarCollapsed, toggleSidebar, threadPanelOpen, searchOpen, openSearch, closeSearch } = useUIStore();

  // Cmd+K / Ctrl+K 快捷键
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchOpen) closeSearch();
        else openSearch();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [searchOpen, openSearch, closeSearch]);

  return (
    <div className="h-screen flex">
      {/* 左侧栏 - 工作区切换 */}
      <Sidebar />

      {/* 频道列表 */}
      <div className={`${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-60'} flex-shrink-0 transition-all duration-200 bg-white border-r border-gray-200`}>
        <ChannelList />
      </div>

      {/* 主消息区 */}
      <div className="flex-1 flex min-w-0 relative">
        {/* 折叠时显示展开按钮 */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="absolute top-3 left-2 z-10 w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            title="展开侧栏"
          >
            ▶
          </button>
        )}
        <MessageArea />
      </div>

      {/* 线程面板 */}
      <ThreadPanel />

      {/* 搜索弹窗 */}
      <SearchModal />

      {/* 文档弹窗 */}
      <DocumentModal />
    </div>
  );
}
