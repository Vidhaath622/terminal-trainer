"use client";

/**
 * TeacherConsole: role-gated authoring surface.
 * Teachers/admins: publish problems (JSON) and quizzes (form or JSON).
 * Students: see the catalog + take quizzes; all mutations are denied client-side.
 * Backed by ContentStore (same permission rules a server would enforce).
 */
import { useMemo, useState } from "react";
import { ContentStore } from "@/roles/client-store";
import { capabilitiesOf, type Role, type User } from "@/roles/types";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import QuizRunner from "./QuizRunner";
import type { Quiz } from "@/roles/quiz";

const ROLE_TABS: Role[] = ["teacher", "student", "admin"];

export default function TeacherConsole() {
  const [role, setRole] = useState<Role>("teacher");
  const user: User = useMemo(
    () => ({ id: role === "teacher" ? "t-demo" : role === "admin" ? "a-demo" : "s-demo", name: `Demo ${role}`, role }),
    [role]
  );
  const store = useMemo(
    () => new ContentStore({ problems: LAUNCH_PROBLEMS, quizzes: [DEMO_QUIZ] }),
    []
  );
  const [, bump] = useState(0);
  const [tab, setTab] = useState<"problems" | "quiz" | "upload">("problems");
  const [json, setJson] = useState(SAMPLE_PROBLEM_JSON);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz>(DEMO_QUIZ);

  const caps = capabilitiesOf(role);
  const canPublish = caps.includes("problem:create");

  const publish = () => {
    try {
      const parsed = JSON.parse(json);
      store.publish(user, "problem", parsed);
      setMessage({ ok: true, text: `Published problem '${parsed.id}'.` });
      bump((n) => n + 1);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Invalid JSON" });
    }
  };

  return (
    <div className="space-y-4">
      {/* role switcher */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-term-border bg-term-panel p-3">
        <span className="text-xs uppercase text-term-text/50">Acting as</span>
        {ROLE_TABS.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded px-2 py-1 text-xs ${
              role === r ? "bg-term-blue/20 text-term-blue" : "border border-term-border text-term-text/70"
            }`}
            data-testid={`role-${r}`}
          >
            {r}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-term-text/50">
          caps: {caps.join(", ") || "none"}
        </span>
      </div>

      <div className="flex gap-2">
        {(["problems", "quiz", "upload"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-xs ${
              tab === t ? "bg-term-panel font-semibold text-term-blue" : "text-term-text/60 hover:text-term-text"
            }`}
          >
            {t === "problems" ? "Problem catalog" : t === "quiz" ? "Quiz / assignment" : "Upload (teachers)"}
          </button>
        ))}
      </div>

      {tab === "problems" && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {store.visibleProblems(user).map((p) => (
            <li key={p.id} className="rounded border border-term-border bg-term-panel p-2 text-xs">
              <span className="font-semibold">{p.title}</span>{" "}
              <span className="text-term-text/50">({p.difficulty})</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "quiz" && (
        <div className="max-w-2xl">
          <QuizRunner quiz={activeQuiz} onSubmit={(earned, max) => setMessage({ ok: true, text: `Scored ${earned}/${max}` })} />
          {!caps.includes("content:answer") && (
            <p className="mt-2 text-xs text-term-yellow">
              Note: teachers can preview but submissions are recorded for students.
            </p>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="max-w-2xl space-y-2" data-testid="upload-panel">
          <p className="text-xs text-term-text/60">
            Paste a problem JSON (schema: steps → checks with marks). Students never see this tab content restrictions apply per role.
          </p>
          <textarea
            className="h-48 w-full rounded border border-term-border bg-term-bg p-2 font-mono text-xs"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            data-testid="upload-json"
          />
          <button
            onClick={publish}
            disabled={!canPublish}
            className="rounded bg-term-green/20 px-3 py-1.5 text-xs font-semibold text-term-green hover:bg-term-green/30 disabled:opacity-40"
            data-testid="upload-publish"
          >
            Publish problem
          </button>
          {!canPublish && (
            <p className="text-xs text-term-red" data-testid="upload-denied">
              ✗ Students cannot publish content. Switch to a teacher role to author.
            </p>
          )}
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.ok ? "text-term-green" : "text-term-red"}`} data-testid="console-message">
          {message.ok ? "✓" : "✗"} {message.text}
        </p>
      )}
    </div>
  );
}

const DEMO_QUIZ: Quiz = {
  id: "demo-quiz",
  title: "Quick terminal quiz",
  kind: "quiz",
  instructions: "Answer all questions. Graded instantly.",
  createdBy: "t-demo",
  visibleTo: ["student"],
  questions: [
    {
      kind: "mcq",
      id: "m1",
      prompt: "Which command prints the current directory?",
      options: [
        { id: "a", text: "pwd" },
        { id: "b", text: "ls" },
        { id: "c", text: "cd" },
      ],
      correctOptionId: "a",
      marks: 2,
    },
    {
      kind: "short",
      id: "s1",
      prompt: "Which flag makes ls show permissions and sizes?",
      acceptedAnswers: ["-l", "ls -l"],
      marks: 3,
    },
  ],
};

const SAMPLE_PROBLEM_JSON = `{
  "id": "teacher-demo-1",
  "title": "My first authored problem",
  "difficulty": "easy",
  "brief": "Create a file and check it exists.",
  "fs": { "dirs": [], "files": [], "home": "/", "user": "student" },
  "steps": [
    {
      "id": "s1",
      "prompt": "Create a file called hello.txt",
      "hints": ["touch hello.txt"],
      "marks": 5,
      "checks": [{ "type": "fileExists", "path": "/hello.txt", "marks": 5 }]
    }
  ]
}`;
