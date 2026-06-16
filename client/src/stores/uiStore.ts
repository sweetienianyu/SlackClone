import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  threadPanelOpen: boolean;
  threadParentId: string | null;
  searchOpen: boolean;
  toggleSidebar: () => void;
  openThread: (parentId: string) => void;
  closeThread: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  threadPanelOpen: false,
  threadParentId: null,
  searchOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openThread: (parentId) => set({ threadPanelOpen: true, threadParentId: parentId }),
  closeThread: () => set({ threadPanelOpen: false, threadParentId: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
