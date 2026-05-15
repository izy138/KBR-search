import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type LightTheme = "default" | "blueAccent" | "yellowBeige" | "mintSlate" | "blueModified";

const VALID_LIGHT_THEMES: ReadonlySet<LightTheme> = new Set([
  "default",
  "blueAccent",
  "yellowBeige",
  "mintSlate",
  "blueModified",
]);

interface UseThemeReturn {
  theme: Theme;
  lightTheme: LightTheme;
  setLightTheme: React.Dispatch<React.SetStateAction<LightTheme>>;
  handleThemeToggle: () => void;
}

/**
 * Manages dark/light mode and light-theme variant preferences.
 * Reads initial values from localStorage, falls back to the OS color-scheme
 * preference for the dark/light toggle, and syncs every change back to
 * localStorage and the <html> data attributes consumed by styles.css.
 */
export function useTheme(): UseThemeReturn {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [lightTheme, setLightTheme] = useState<LightTheme>(() => {
    if (typeof window === "undefined") return "default";
    const stored = window.localStorage.getItem("lightTheme");
    if (stored && VALID_LIGHT_THEMES.has(stored as LightTheme)) {
      return stored as LightTheme;
    }
    return "default";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-light-theme", lightTheme);
    window.localStorage.setItem("lightTheme", lightTheme);
  }, [lightTheme]);

  const handleThemeToggle = (): void => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, lightTheme, setLightTheme, handleThemeToggle };
}
