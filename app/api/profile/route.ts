import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { lifeProfiles } from "../../../db/schema";
import { currentUser } from "../../../lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getDb().select().from(lifeProfiles).where(eq(lifeProfiles.userId, user.id)).limit(1);
  return NextResponse.json({
    profile: rows[0] ?? {
      userId: user.id,
      birthDate: null,
      targetAge: 90,
      locale: "en",
      country: null,
      timezone: "UTC",
    },
    user: { name: user.name, email: user.email, image: user.image },
  });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const birthDate = typeof body.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) ? body.birthDate : null;
  const targetAge = Math.min(120, Math.max(40, Number(body.targetAge) || 90));
  const locale = ["en", "zh", "es", "ja"].includes(String(body.locale)) ? String(body.locale) : "en";
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : "UTC";
  const country = typeof body.country === "string" ? body.country.slice(0, 2).toUpperCase() : null;
  const now = new Date();
  await getDb().insert(lifeProfiles).values({
    userId: user.id,
    birthDate,
    targetAge,
    locale,
    timezone,
    country,
    privacyAcceptedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: lifeProfiles.userId,
    set: { birthDate, targetAge, locale, timezone, country, updatedAt: now },
  });
  return NextResponse.json({ success: true });
}
