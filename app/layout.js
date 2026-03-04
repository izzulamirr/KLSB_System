import "./globals.css";
import FloatingRemindersWidget from "../components/bd/FloatingRemindersWidget";

export const metadata = { title: "KLSB Portal", description: "Secure Access" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FloatingRemindersWidget />
      </body>
    </html>
  );
}