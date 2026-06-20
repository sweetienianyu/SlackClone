import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  threadPanelOpen: boolean;
  threadParentId: string | null;
  searchOpen: boolean;
  documentModalOpen: boolean;
  documentId: string | null;
  adminPanelOpen: boolean;
  toggleSidebar: () => void;
  openThread: (parentId: string) => void;
  closeThread: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openDocumentModal: (docId?: string | null) => void;
  closeDocumentModal: () => void;
  openAdminPanel: () => void;
  closeAdminPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  threadPanelOpen: false,
  threadParentId: null,
  searchOpen: false,
  documentModalOpen: false,
  documentId: null,
  adminPanelOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openThread: (parentId) => set({ threadPanelOpen: true, threadParentId: parentId }),
  closeThread: () => set({ threadPanelOpen: false, threadParentId: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openDocumentModal: (docId) => set({ documentModalOpen: true, documentId: docId || null }),
  closeDocumentModal: () => set({ documentModalOpen: false, documentId: null }),
  openAdminPanel: () => set({ adminPanelOpen: true }),
  closeAdminPanel: () => set({ adminPanelOpen: false }),
}));
