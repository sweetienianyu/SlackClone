import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  threadPanelOpen: boolean;
  threadParentId: string | null;
  searchOpen: boolean;
  documentModalOpen: boolean;
  documentId: string | null;
  toggleSidebar: () => void;
  openThread: (parentId: string) => void;
  closeThread: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openDocumentModal: (docId?: string | null) => void;
  closeDocumentModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  threadPanelOpen: false,
  threadParentId: null,
  searchOpen: false,
  documentModalOpen: false,
  documentId: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openThread: (parentId) => set({ threadPanelOpen: true, threadParentId: parentId }),
  closeThread: () => set({ threadPanelOpen: false, threadParentId: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openDocumentModal: (docId) => set({ documentModalOpen: true, documentId: docId || null }),
  closeDocumentModal: () => set({ documentModalOpen: false, documentId: null }),
}));
