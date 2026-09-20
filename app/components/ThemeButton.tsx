"use client";

import { useTheme } from "../../lib/use-theme";

// The legal pages are server components, so the control is split out rather than making the whole
// page client-rendered - the same reason LocaleSelect exists for the guide pages. The accessible
// name comes from the caller, and the icon and class match the home page control exactly, so a
// screen reader hears one phrase wherever the control appears.
export function ThemeButton({ label }: { label: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <button
      className="theme-button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={label}
    >
      {theme === "light" ? "◐" : "☼"}
    </button>
  );
}
