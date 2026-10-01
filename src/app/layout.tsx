import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Terminal Trainer: graded Linux practice",
  description:
    "Practice Linux terminal commands in a simulated shell with graded, step-by-step problems. Built for first-year CS students; embeds into any college website.",
  openGraph: {
    title: "Terminal Trainer: graded Linux practice",
    description:
      "Practice Linux terminal commands in a simulated shell with graded, step-by-step problems.",
    type: "website",
    siteName: "Terminal Trainer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terminal Trainer: graded Linux practice",
    description:
      "Practice Linux terminal commands in a simulated shell with graded, step-by-step problems.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${sourceSerif.variable}`}>
      <body className="min-h-screen bg-term-bg font-sans text-term-text antialiased">{children}</body>
    </html>
  );
}
