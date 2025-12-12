"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "../../stores/preferences-store";

export function ThemeWatcher() {
  const darkMode = usePreferencesStore((s) => s.darkMode);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
    }
  }, [darkMode]);

  return null;
}
