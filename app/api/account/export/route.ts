import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { lifeProfiles, lifeRecords } from "../../../../db/schema";
import { currentUser } from "../../../../lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const [profiles, records] = await Promise.all([
    db.select().from(lifeProfiles).where(eq(lifeProfiles.userId, user.id)).limit(1),
    db.select().from(lifeRecords).where(eq(lifeRecords.userId, user.id)).orderBy(desc(lifeRecords.occurredOn)),
  ]);
  return new Response(JSON.stringify({
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email },
    profile: profiles[0] ?? null,
    records,
  }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": "attachment; filename=lifescale-export.json",
    },
  });
}
