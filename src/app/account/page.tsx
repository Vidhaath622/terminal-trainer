import type { Metadata } from "next";
import AccountClient from "@/components/AccountClient";

export const metadata: Metadata = {
  title: "Your account — Terminal Trainer",
  description: "GitHub-linked profile, synced marks, and per-problem progress.",
};

export default function AccountPage() {
  return <AccountClient />;
}
