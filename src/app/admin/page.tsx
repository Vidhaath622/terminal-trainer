import SiteHeader from "@/components/SiteHeader";
import OwnerPanel from "@/components/OwnerPanel";

export const metadata = {
  title: "Terminal Trainer: owner console",
  description:
    "Owner-only panel: assign student or teacher to every GitHub account that has signed in.",
};

/**
 * /admin — the owner's role panel. Deliberately unlinked in the navigation;
 * the UI gates on /api/me's isOwner flag and the /api/admin/* routes enforce
 * the same check server-side, so the page is inert for everyone else.
 */
export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="mb-8">
          <h1 className="font-mono text-2xl font-bold">Owner console</h1>
          <p className="prose-body mt-2 text-sm text-term-muted">
            Assign <em>student</em> or <em>teacher</em> to every GitHub account
            that has signed in. Only the owner account — named by
            <code> OWNER_GITHUB_IDS</code> / <code> OWNER_LOGINS</code> on the
            server — can open this panel; anonymous visitors are always
            students.
          </p>
        </header>
        <OwnerPanel />
      </main>
    </>
  );
}
