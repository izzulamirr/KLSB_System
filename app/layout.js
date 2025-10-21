import "./globals.css";

export const metadata = { title: "KLSB Portal", description: "Secure Access" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}