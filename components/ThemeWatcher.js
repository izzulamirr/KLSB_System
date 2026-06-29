"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, THEME_STORAGE_KEY } from "../lib/theme";

// Mounted once at the root so "Auto" keeps following the OS theme even on
// pages other than Settings, a theme change made in one tab is mirrored in
// any other open tab, and navigating into/out of /dashboard (client-side,
// so no full reload) re-evaluates whether dark mode should apply.
export default function ThemeWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "light", pathname);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      const theme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
      if (theme === "auto") applyTheme("auto", pathname);
    }
    mql.addEventListener("change", handleSystemChange);

    function handleStorage(event) {
      if (event.key === THEME_STORAGE_KEY) applyTheme(event.newValue || "light", pathname);
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      mql.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname]);

  return null;
}
