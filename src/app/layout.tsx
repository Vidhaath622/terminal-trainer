import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terminal Trainer",
  description: "Practice Linux terminal commands with graded, step-by-step problems.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-term-bg text-term-text min-h-screen">{children}</body>
    </html>
  );
}
