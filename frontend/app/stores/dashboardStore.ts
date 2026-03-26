"use client";

import { create } from "zustand";

interface DashboardUIState {
  translationModalOpen: boolean;
  projectModalOpen: boolean;
  splitButtonOpen: boolean;
  openTranslationModal: () => void;
  closeTranslationModal: () => void;
  openProjectModal: () => void;
  closeProjectModal: () => void;
  toggleSplitButton: () => void;
  closeSplitButton: () => void;
}

export const useDashboardStore = create<DashboardUIState>()((set) => ({
  translationModalOpen: false,
  projectModalOpen: false,
  splitButtonOpen: false,
  openTranslationModal: () => set({ translationModalOpen: true }),
  closeTranslationModal: () => set({ translationModalOpen: false }),
  openProjectModal: () => set({ projectModalOpen: true }),
  closeProjectModal: () => set({ projectModalOpen: false }),
  toggleSplitButton: () => set((s) => ({ splitButtonOpen: !s.splitButtonOpen })),
  closeSplitButton: () => set({ splitButtonOpen: false }),
}));
