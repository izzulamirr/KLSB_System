import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";

export const metadata = { title: "KLSB Portal", description: "Secure Access" };

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={jakarta.variable}>{children}</body>
    </html>
  );
}