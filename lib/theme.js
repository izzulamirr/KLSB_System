export const THEME_STORAGE_KEY = "klsb:theme";

// Dark mode only re-skins the authenticated dashboard shell. Pages outside
// it (login, BD portal, admin) still use hardcoded light-mode colors that
// haven't been given dark: variants, so flipping the global `dark` class
// there would make their text unreadable against the dark background.
export function isDashboardPath(pathname) {
  return typeof pathname === "string" && /\/dashboard(\/|$)/.test(pathname);
}

export function resolveIsDark(theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme, pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  if (typeof document === "undefined") return;
  const shouldBeDark = isDashboardPath(pathname) && resolveIsDark(theme);
  document.documentElement.classList.toggle("dark", shouldBeDark);
}
