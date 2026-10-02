/**
 * Neon Postgres access. Tables are created lazily on first use so the project
 * needs no migration tooling — point DATABASE_URL at a fresh Neon database
 * and the first request sets up the schema.
 *
 * users(github_id PK)  — GitHub identity per account, plus the role the owner
 *   panel assigns (role; role_assigned_at stays NULL until the panel sets it,
 *   which is what lets env allowlists keep governing untouched rows).
 * progress(github_id + problem_id) — one JSONB blob per problem, mirroring
 * the client's SessionProgress shape.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Role } from "@/roles/types";
import { normalizeRole } from "./authz";

let client: NeonQueryFunction<false, false> | null = null;
let initPromise: Promise<void> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  client = neon(url);
  return client;
}

async function ensureTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const sql = getClient();
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          github_id BIGINT PRIMARY KEY,
          login TEXT NOT NULL,
          name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS progress (
          github_id BIGINT NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
          problem_id TEXT NOT NULL,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (github_id, problem_id)
        )`;
      // Role columns: added lazily so pre-existing databases upgrade in place.
      // Existing rows land as role='student' + NULL role_assigned_at, i.e.
      // "never assigned by the panel" — env allowlists still govern them.
      await sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role_assigned_at TIMESTAMPTZ;
      `;
    })().catch((err) => {
      initPromise = null; // allow retry on a later request
      throw err;
    });
  }
  return initPromise;
}

export interface DbUser {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  /** stored role — effective only once roleAssignedAt is set (see authz.effectiveRole) */
  role: Role;
  /** when the owner assigned a role in the /admin panel; null = never */
  roleAssignedAt: string | null;
}

function rowToUser(r: Record<string, unknown>): DbUser {
  return {
    githubId: Number(r.github_id),
    login: String(r.login),
    name: (r.name as string | null) ?? null,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    role: normalizeRole(r.role),
    roleAssignedAt: r.role_assigned_at
      ? new Date(r.role_assigned_at as string | Date).toISOString()
      : null,
  };
}

export async function upsertUser(
  user: Pick<DbUser, "githubId" | "login" | "name" | "avatarUrl">
): Promise<DbUser> {
  await ensureTables();
  // ON CONFLICT never touches role/role_assigned_at: panel assignments survive
  // every re-login, and a fresh row lands with the defaults (student / NULL).
  const rows = await getClient()`
    INSERT INTO users (github_id, login, name, avatar_url)
    VALUES (${user.githubId}, ${user.login}, ${user.name}, ${user.avatarUrl})
    ON CONFLICT (github_id) DO UPDATE
      SET login = EXCLUDED.login, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
    RETURNING github_id, login, name, avatar_url, created_at, role, role_assigned_at`;
  return rowToUser(rows[0]);
}

export async function getUser(githubId: number): Promise<DbUser | null> {
  await ensureTables();
  const rows = await getClient()`
    SELECT github_id, login, name, avatar_url, created_at, role, role_assigned_at
    FROM users WHERE github_id = ${githubId}`;
  const r = rows[0];
  return r ? rowToUser(r) : null;
}

export interface ProgressRow {
  problemId: string;
  data: unknown;
  updatedAt: string;
}

export async function listProgress(githubId: number): Promise<ProgressRow[]> {
  await ensureTables();
  const rows = await getClient()`
    SELECT problem_id, data, updated_at
    FROM progress WHERE github_id = ${githubId}
    ORDER BY updated_at DESC`;
  return rows.map((r) => ({
    problemId: r.problem_id,
    data: r.data,
    updatedAt: (r.updated_at as Date).toISOString(),
  }));
}

export async function getProgress(
  githubId: number,
  problemId: string
): Promise<ProgressRow | null> {
  await ensureTables();
  const rows = await getClient()`
    SELECT problem_id, data, updated_at
    FROM progress WHERE github_id = ${githubId} AND problem_id = ${problemId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    problemId: r.problem_id,
    data: r.data,
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

export async function putProgress(
  githubId: number,
  problemId: string,
  data: unknown
): Promise<string> {
  await ensureTables();
  const rows = await getClient()`
    INSERT INTO progress (github_id, problem_id, data, updated_at)
    VALUES (${githubId}, ${problemId}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (github_id, problem_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = now()
    RETURNING updated_at`;
  return (rows[0].updated_at as Date).toISOString();
}

export async function deleteAccount(githubId: number): Promise<void> {
  await ensureTables();
  // progress rows cascade; session cookie is cleared by the route
  await getClient()`DELETE FROM users WHERE github_id = ${githubId}`;
}

/** Every signed-in account, newest first — the owner panel's roster. */
export async function listUsersWithRoles(): Promise<DbUser[]> {
  await ensureTables();
  const rows = await getClient()`
    SELECT github_id, login, name, avatar_url, created_at, role, role_assigned_at
    FROM users ORDER BY created_at DESC, github_id DESC`;
  return rows.map((r) => rowToUser(r));
}

/**
 * Owner-panel role assignment. Stamps role_assigned_at, so from then on the
 * panel value wins over the env allowlists (see authz.effectiveRole).
 * Returns false when no such account exists.
 */
export async function setUserRole(githubId: number, role: Role): Promise<boolean> {
  await ensureTables();
  const rows = await getClient()`
    UPDATE users SET role = ${role}, role_assigned_at = now()
    WHERE github_id = ${githubId}
    RETURNING github_id`;
  return rows.length > 0;
}
