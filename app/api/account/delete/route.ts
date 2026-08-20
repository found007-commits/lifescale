import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { deletionRequests, user as users } from "../../../../db/schema";
import { currentUser } from "../../../../lib/session";

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const emailHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.email.toLowerCase()));
  const emailHash = Array.from(new Uint8Array(emailHashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const db = getDb();
  await db.insert(deletionRequests).values({
    id: crypto.randomUUID(),
    userId: user.id,
    emailHash,
    status: "completed",
    completedAt: now,
  });
  await db.delete(users).where(eq(users.id, user.id));
  return Response.json({ success: true });
}
