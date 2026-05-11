import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spanish Buzzer Game",
  description: "Hack the matrix. Hack the Spanish quiz.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="grid-bg" />
        <div className="content">{children}</div>
        <div className="shader-overlay" />
      </body>
    </html>
  );
}
