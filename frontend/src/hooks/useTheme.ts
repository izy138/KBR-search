import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface UseThemeReturn {
  theme: Theme;
  handleThemeToggle: () => void;
}

export function useTheme(): UseThemeReturn {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const handleThemeToggle = (): void => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, handleThemeToggle };
}
