import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRINCES Attendance",
  description: "Sistem kehadiran Princes",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
