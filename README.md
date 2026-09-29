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
| Commands | `src/engine/commands/` | 24 commands incl. grep/find/chmod/tree |
| Problems & checks | `src/engine/schema.ts` | Zod schema, 14 check types, marks invariant |
| Grader | `src/engine/grader.ts` | Per-check pass/fail + human messages |
| Session | `src/engine/session.ts` | Auto-grading, events, reset, persistence |
| Launch problems | `src/problems/launch.ts` | 9 problems, each with a tested solution |
| Roles | `src/roles/` | Teacher/student/admin capabilities, quizzes, submissions |
| Embed API | `src/embed/protocol.ts` | postMessage types + host helper |
| UI | `src/components/`, `src/app/` | xterm terminal, player, teacher console, docs |

Routes: `/` (catalog) · `/play/[id]` (practice) · `/embed` (iframe widget) ·
`/teacher` (role console) · `/quiz` (quiz demo) · `/docs/embed` (integration guide).

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

189 tests across engine, roles, embed protocol, and the launch problem set — including
a machine-verified solution path for every problem (full marks proven, not assumed).
