import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import FloatingRemindersWidget from "../components/bd/FloatingRemindersWidget";
import { NEXT_BASE_PATH } from "../lib/apiPath";

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
    <html lang="en">
      <head>
        <link rel="icon" href={iconPath} />
        <link rel="shortcut icon" href={iconPath} />
        <link rel="apple-touch-icon" href={iconPath} />
      </head>
      <body className={jakarta.variable}>
        {children}
        <FloatingRemindersWidget />
      </body>
    </html>
  );
}