import SiteHeader from "@/components/SiteHeader";
import TeacherConsole from "@/components/TeacherConsole";

export const metadata = {
  title: "Terminal Trainer: teacher console",
  description:
    "Local demo of role capability checks: teachers author and publish; students only view and answer.",
};

export default function TeacherPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="mb-8">
          <h1 className="font-mono text-2xl font-bold">Teacher console</h1>
          <p className="prose-body mt-2 text-sm text-term-muted">
            A local demo of the permission walls: switch roles to see teachers
            author and publish while students only view and answer — every
            mutation is checked against role capabilities in the content store.
            Nothing published here is sent anywhere (there is no authoring API);
            your <em>server-computed</em> account role is shown above and comes
            from deploy-time allowlists.
          </p>
        </header>
        <TeacherConsole />
      </main>
    </>
  );
}
