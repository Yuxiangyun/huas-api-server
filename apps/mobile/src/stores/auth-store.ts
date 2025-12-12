import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserProfile } from "../types/api";

type AuthState = {
  token?: string;
  expiresAt?: number;
  user?: UserProfile;
  setToken: (token: string, maxAgeSeconds: number) => void;
  setUser: (user?: UserProfile) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: undefined,
      expiresAt: undefined,
      user: undefined,
      setToken: (token, maxAgeSeconds) => {
        const expiresAt = Date.now() + maxAgeSeconds * 1000;
        set({ token, expiresAt });
      },
      setUser: (user) => set({ user }),
      clear: () => set({ token: undefined, user: undefined, expiresAt: undefined }),
    }),
    {
      name: "huas-auth",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state?.expiresAt) return;
        if (Date.now() > state.expiresAt) {
          state.clear();
        }
      },
    },
  ),
);
