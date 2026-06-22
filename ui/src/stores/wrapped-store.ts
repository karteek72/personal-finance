"use client";

import { create } from "zustand";

interface WrappedState {
  open: boolean;
  openWrapped: () => void;
  closeWrapped: () => void;
}

export const useWrappedStore = create<WrappedState>((set) => ({
  open: false,
  openWrapped: () => set({ open: true }),
  closeWrapped: () => set({ open: false }),
}));
