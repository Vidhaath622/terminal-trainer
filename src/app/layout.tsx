import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Terminal Trainer — graded Linux practice",
  description:
    "Practice Linux terminal commands with graded, step-by-step problems. Built for first-year CS students; embeds into any college website.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-term-bg font-sans text-term-text min-h-screen antialiased">{children}</body>
    </html>
  );
}
