import TeacherConsole from "@/components/TeacherConsole";

export default function TeacherPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-bold">Teacher console</h1>
      <p className="mb-6 text-sm text-term-text/60">
        Switch roles to see the permission walls: teachers author and publish; students only view and answer.
      </p>
      <TeacherConsole />
    </main>
  );
}
