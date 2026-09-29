import TeacherConsole from "@/components/TeacherConsole";

export default function TeacherPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
      <header className="mb-8 animate-slideUp">
        <p className="text-xs font-semibold uppercase tracking-widest text-term-violet">Roles & permissions</p>
        <h1 className="mt-1 text-2xl font-bold">Teacher console</h1>
        <p className="mt-2 max-w-2xl text-sm text-term-muted">
          Switch roles to see the permission walls live: teachers author and publish; students only view and answer. Every mutation is capability-checked — try publishing as a student.
        </p>
      </header>
      <TeacherConsole />
    </main>
  );
}
