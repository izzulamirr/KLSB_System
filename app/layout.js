import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import FloatingRemindersWidget from "../components/bd/FloatingRemindersWidget";
import ThemeWatcher from "../components/ThemeWatcher";
import { NEXT_BASE_PATH } from "../lib/apiPath";

// Applies the saved theme before first paint so there's no flash of the
// wrong theme. Plain inline script (not a module) since it must run
// synchronously ahead of hydration. Dark mode only applies under
// /dashboard — other pages (login, BD portal, admin) don't have dark:
// variants yet, so leaking the `dark` class there would make their
// hardcoded-color text unreadable.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var isDashboard = /\\/dashboard(\\/|$)/.test(window.location.pathname);
    var theme = localStorage.getItem("klsb:theme") || "light";
    var isDark = isDashboard && (theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

export const metadata = {
  title: "KLSB Portal",
  description: "Secure Access",
};

const iconPath = NEXT_BASE_PATH ? `${NEXT_BASE_PATH}/KLSB_icon.png` : "/KLSB_icon.png";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={iconPath} />
        <link rel="shortcut icon" href={iconPath} />
        <link rel="apple-touch-icon" href={iconPath} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={jakarta.variable}>
        <ThemeWatcher />
        {children}
        <FloatingRemindersWidget />
      </body>
    </html>
  );
}