# Terminal Trainer

An embeddable, browser-based Linux terminal practice platform for first-year CS students.
Students solve step-by-step problems in a simulated shell; every step is auto-graded for
marks; a Verify button runs test-case-style checks with per-check feedback. Designed to
drop into **any** college website via an iframe + postMessage API — your site owns the
students, this owns the practice environment.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest (engine, roles, embed, problems)
npm run build      # production build
```

## What's inside

| Area | Location | Notes |
| --- | --- | --- |
| Virtual filesystem | `src/engine/vfs.ts` | Dirs/files with modes, owners, snapshots |
| Shell parser | `src/engine/parser.ts` | Quotes, escapes, pipes, `>` `>>` |
| Commands | `src/engine/commands/` | 27 commands incl. grep/find/chmod/tree and simulated git |
| Problems & checks | `src/engine/schema.ts` | Zod schema, 15 check types, marks invariant |
| Grader | `src/engine/grader.ts` | Per-check pass/fail + human messages |
| Session | `src/engine/session.ts` | Auto-grading, events, reset, persistence |
| Launch problems | `src/problems/launch.ts` | 30 problems incl. a 10-problem Git track, each with a tested solution |
| Roles | `src/roles/` | Teacher/student/admin capabilities, quizzes, submissions |
| Embed API | `src/embed/protocol.ts` | postMessage types + host helper |
| UI | `src/components/`, `src/app/` | xterm terminal, player, teacher console, docs |
| GitHub auth + sync | `src/server/`, `src/lib/sync.ts` | OAuth, Neon Postgres, signed cookies |
| Account dashboard | `src/app/account`, `src/components/AccountClient.tsx` | synced marks & progress |

Routes: `/` (home) · `/problems` (catalog) · `/git-problems` (Git problems) · `/play/[id]` (practice) · `/embed` (iframe widget) ·
`/teacher` (role console) · `/quiz` (quiz demo) · `/docs/embed` (integration guide) ·
`/account` (GitHub-linked progress) · `/api/*` (auth + progress functions).

## GitHub accounts & cloud progress sync

Visitors can link a GitHub account; per-problem progress (marks, completed steps,
command history) is saved to Postgres and restored on any device. Anonymous visitors
keep pure-localStorage progress. Setup (env vars read by `/api/*`):

```bash
GITHUB_CLIENT_ID=...      # OAuth app: callback https://YOUR-HOST/api/auth/callback/github
GITHUB_CLIENT_SECRET=...
SESSION_SECRET=...        # openssl rand -base64 32
DATABASE_URL=...          # Neon Postgres connection string (tables auto-create)
```

When signed in, completions are debounce-pushed to `/api/progress/[problemId]`;
`/play` restores the freshest of local vs cloud. `/account` shows synced totals and
a disconnect action (deletes cloud rows). The `/embed` widget stays anonymous and
does not render sign-in chrome.

## Embedding into a college website

```html
<iframe src="https://your-host/embed?problem=grep-search&student=roll-42"
        style="width:100%;height:600px;border:0"></iframe>
```

The widget posts `tt:ready`, `tt:step:completed`, `tt:problem:completed`, and
`tt:progress` messages to the host page; the host sends `tt:init` (studentId,
problemId, or an inline teacher-authored problem JSON) and `tt:reset`. Full guide
with copy-paste snippets: `/docs/embed`. Protocol types: `src/embed/protocol.ts`.

## Roles

- **Teachers** author problems, quizzes, assignments; upload test cases; see all progress.
- **Students** view and answer content; see only their own progress; cannot publish.
- **Admins** manage users and inherit everything.

Enforced by typed capability guards (`src/roles/types.ts`) used by the content store —
the same rules a server backend would enforce.

## Testing

250+ tests across engine (including simulated git), roles, embed protocol, the
launch problem set, progress sync helpers, and session cookie crypto — including
a machine-verified solution path for every problem (full marks proven, not
assumed).
