import SiteHeader from "@/components/SiteHeader";
import TeacherConsole from "@/components/TeacherConsole";

export const metadata = {
  title: "Terminal Trainer: teacher console",
  description:
    "Switch roles to see the capability checks live: teachers author and publish; students only view and answer.",
};

export default function TeacherPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="mb-8">
          <h1 className="font-mono text-2xl font-bold">Teacher console</h1>
          <p className="prose-body mt-2 text-sm text-term-muted">
            Switch roles to see the permission walls live: teachers author and
            publish; students only view and answer. Every mutation is checked
            against role capabilities in the content store — try publishing as
            a student.
          </p>
        </header>
        <TeacherConsole />
      </main>
    </>
  );
}
