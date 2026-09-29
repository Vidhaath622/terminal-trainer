/**
 * Neon Postgres access. Tables are created lazily on first use so the project
 * needs no migration tooling — point DATABASE_URL at a fresh Neon database
 * and the first request sets up the schema.
 *
 * users(github_id PK)  — GitHub identity per account
 * progress(github_id + problem_id) — one JSONB blob per problem, mirroring
 * the client's SessionProgress shape.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

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
}

export async function upsertUser(
  user: Omit<DbUser, "createdAt">
): Promise<DbUser> {
  await ensureTables();
  const rows = await getClient()`
    INSERT INTO users (github_id, login, name, avatar_url)
    VALUES (${user.githubId}, ${user.login}, ${user.name}, ${user.avatarUrl})
    ON CONFLICT (github_id) DO UPDATE
      SET login = EXCLUDED.login, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
    RETURNING github_id, login, name, avatar_url, created_at`;
  const r = rows[0];
  return {
    githubId: Number(r.github_id),
    login: r.login,
    name: r.name,
    avatarUrl: r.avatar_url,
    createdAt: (r.created_at as Date).toISOString(),
  };
}

export async function getUser(githubId: number): Promise<DbUser | null> {
  await ensureTables();
  const rows = await getClient()`
    SELECT github_id, login, name, avatar_url, created_at
    FROM users WHERE github_id = ${githubId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    githubId: Number(r.github_id),
    login: r.login,
    name: r.name,
    avatarUrl: r.avatar_url,
    createdAt: (r.created_at as Date).toISOString(),
  };
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
