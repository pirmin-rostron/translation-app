"use client";

import { create } from "zustand";

interface DashboardUIState {
  translationModalOpen: boolean;
  preselectedProjectId: number | null;
  projectModalOpen: boolean;
  splitButtonOpen: boolean;
  openTranslationModal: (projectId?: number) => void;
  closeTranslationModal: () => void;
  openProjectModal: () => void;
  closeProjectModal: () => void;
  toggleSplitButton: () => void;
  closeSplitButton: () => void;
}

export const useDashboardStore = create<DashboardUIState>()((set) => ({
  translationModalOpen: false,
  preselectedProjectId: null,
  projectModalOpen: false,
  splitButtonOpen: false,
  openTranslationModal: (projectId?: number) => set({ translationModalOpen: true, preselectedProjectId: projectId ?? null }),
  closeTranslationModal: () => set({ translationModalOpen: false, preselectedProjectId: null }),
  openProjectModal: () => set({ projectModalOpen: true }),
  closeProjectModal: () => set({ projectModalOpen: false }),
  toggleSplitButton: () => set((s) => ({ splitButtonOpen: !s.splitButtonOpen })),
  closeSplitButton: () => set({ splitButtonOpen: false }),
}));
