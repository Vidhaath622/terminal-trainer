import { NextResponse, type NextRequest } from "next/server";
import { currentUser, serverError, unauthorized } from "@/server/http";
import { listProgress } from "@/server/db";

/**
 * GET /api/progress — every saved progress blob for the signed-in user.
 * Response: { progress: Array<{ problemId, data, updatedAt }> }
 */
export async function GET(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return unauthorized();
  try {
    const progress = await listProgress(session.githubId);
    return NextResponse.json({ progress });
  } catch (err) {
    console.error("progress GET: db error", err);
    return serverError("could not load progress");
  }
}
