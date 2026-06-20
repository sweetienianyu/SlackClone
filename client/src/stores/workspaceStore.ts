import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Workspace } from '../types';

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace: (ws: Workspace) => void;
  setWorkspaces: (ws: Workspace[]) => void;
  addWorkspace: (ws: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      workspaces: [],
      setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      addWorkspace: (ws) => set((s) => ({ workspaces: [...s.workspaces, ws] })),
    }),
    {
      name: 'slackclone-workspaces',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
