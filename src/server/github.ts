/**
 * GitHub OAuth web application flow, server side only.
 * Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

export function githubClientId(): string {
  const id = process.env.GITHUB_CLIENT_ID;
  if (!id) throw new Error("GITHUB_CLIENT_ID is not set");
  return id;
}

function githubClientSecret(): string {
  const s = process.env.GITHUB_CLIENT_SECRET;
  if (!s) throw new Error("GITHUB_CLIENT_SECRET is not set");
  return s;
}

/** Build the authorize URL the user's browser is redirected to. */
export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: githubClientId(),
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
    allow_signup: "true",
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export interface GithubTokenResponse {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<GithubTokenResponse> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`github token exchange failed (${res.status})`);
  const json = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!json.access_token) {
    throw new Error(json.error_description ?? json.error ?? "no access_token from github");
  }
  return {
    accessToken: json.access_token,
    tokenType: json.token_type ?? "bearer",
    scope: json.scope ?? "",
  };
}

export interface GithubProfile {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function fetchGithubUser(accessToken: string): Promise<GithubProfile> {
  const res = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "terminal-trainer",
    },
  });
  if (!res.ok) throw new Error(`github /user failed (${res.status})`);
  const json = (await res.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };
  return {
    githubId: json.id,
    login: json.login,
    name: json.name,
    avatarUrl: json.avatar_url,
  };
}
