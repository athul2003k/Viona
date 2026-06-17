// hooks/useSidebarStore.ts
// Zustand store for sidebar collapsed state — replaces module-level variable + manual localStorage

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarStore = {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
    }),
    { name: 'sidebar-collapsed' }
  )
);
