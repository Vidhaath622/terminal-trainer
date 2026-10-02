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
| API gate | `src/middleware.ts`, `src/server/api-allowlist.ts` | Deny-by-default `/api/*` allowlist + server-side roles (`src/server/authz.ts`) |
| Embed API | `src/embed/protocol.ts` | postMessage types + host helper |
| UI | `src/components/`, `src/app/` | xterm terminal, player, teacher console, docs |
| GitHub auth + sync | `src/server/`, `src/lib/sync.ts` | OAuth, Neon Postgres, encrypted session cookies |
| Account dashboard | `src/app/account`, `src/components/AccountClient.tsx` | synced marks & progress |

Routes: `/` (home) · `/problems` (catalog) · `/git-problems` (Git problems) · `/play/[id]` (practice) · `/embed` (iframe widget) ·
`/teacher` (role demo) · `/admin` (owner role panel) · `/quiz` (quiz demo) ·
`/docs/embed` (integration guide) · `/account` (GitHub-linked progress) ·
`/api/*` (auth + progress functions).

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
problemId from the `tt:ready` list — inline host-authored problem JSON is
rejected) and `tt:reset`. Full guide with copy-paste snippets: `/docs/embed`.
Protocol types: `src/embed/protocol.ts`.

## Security

- **Headers** (`next.config.js`): CSP (`default-src 'self'`, no `object-src`), `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS. `frame-ancestors 'self'` everywhere
  (clickjacking protection) **except `/embed`, which stays frameable by any site** —
  that is the product.
- **Session cookie**: AES-256-GCM-encrypted payload keyed from `SESSION_SECRET`, httpOnly,
  with a server-side 10-day expiry enforced on `iat`. The retired HMAC format is rejected,
  so existing users re-login once after upgrading.
- **API abuse controls**: same-origin (CSRF) check on every state-changing route, a 256 KiB
  cap on progress bodies, and per-IP/per-user rate limits on OAuth, progress writes, logout,
  and account deletion (`src/server/ratelimit.ts`; best-effort per serverless instance).
- **No remote authoring (deny-by-default API)**: `/api/*` middleware 404s/405s anything
  outside the explicit allowlist (`src/server/api-allowlist.ts` — progress sync, `/api/me`,
  OAuth, logout, account deletion). `src/server/route-surface.test.ts` fails CI if a route file
  and the allowlist ever disagree, so an authoring endpoint cannot appear by accident.
- **Server-authoritative roles**: role is computed server-side (`src/server/authz.ts`, reported
  on `/api/me`) with the precedence **owner → panel assignment → env allowlist → student**.
  `ADMIN_GITHUB_IDS`/`ADMIN_LOGINS`/`TEACHER_GITHUB_IDS`/`TEACHER_LOGINS` seed and fall back;
  anonymous visitors are always `student` (zero authoring caps). Capability checks take session
  identity only — a client-asserted role can never reach one.
- **Owner-only role panel**: `/admin` + `GET/PATCH /api/admin/users*` are gated on
  `OWNER_GITHUB_IDS`/`OWNER_LOGINS` — 401 without a session, 403 for everyone else (env-admins
  included), CSRF-checked, rate-limited, and `role` is schema-validated to `student|teacher`,
  so `admin`/`owner` can never be granted over the API. Assignments live in `users.role`
  (stamped `role_assigned_at`) and survive re-logins (`ON CONFLICT` never touches them).
- **Embed hardening**: the widget only accepts `tt:` commands from its parent window;
  hosts can pin origins with `&origin=https://their-site.edu` (also used as the outbound
  `postMessage` target), and **inline host-authored problem JSON is rejected** — remote
  pages choose built-in `problemId`s only.

## Roles

- **Teachers** author problems, quizzes, assignments; upload test cases; see all progress.
- **Students** view and answer content; see only their own progress; cannot publish.
- **Admins** manage users and inherit everything.

Enforced by typed capability guards (`src/roles/types.ts`) used by the content store, and
server-side by `src/server/authz.ts` (session-shaped input only). Role truth is always
server-computed (`/api/me`); the `/teacher` console's "acting as" switcher is an explicitly
local demo — there is no authoring API anywhere.

Roles are assigned by the owner through the **`/admin` panel** (owner-only; student/teacher
per signed-in GitHub account, stored in `users.role`). Resolution order: owner → panel
assignment → env allowlist → student.

## Testing

250+ tests across engine (including simulated git), roles, embed protocol, the
launch problem set, progress sync helpers, and session cookie crypto — including
a machine-verified solution path for every problem (full marks proven, not
assumed).
