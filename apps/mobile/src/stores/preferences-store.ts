import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type PreferencesState = {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      darkMode: false,
      setDarkMode: (value) => set({ darkMode: value }),
    }),
    {
      name: "huas-preferences",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
