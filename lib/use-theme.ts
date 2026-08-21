"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("lifescale:theme") as Theme | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = initial;
    const frame = window.requestAnimationFrame(() => setThemeState(initial));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("lifescale:theme", next);
  }

  return { theme, setTheme };
}
