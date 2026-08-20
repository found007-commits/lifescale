import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { lifeRecords } from "../../../db/schema";
import { currentUser } from "../../../lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await getDb().select().from(lifeRecords)
    .where(eq(lifeRecords.userId, user.id))
    .orderBy(desc(lifeRecords.occurredOn), desc(lifeRecords.createdAt))
    .limit(100);
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const title = String(body.title ?? "").trim().slice(0, 120);
  const content = String(body.content ?? "").trim().slice(0, 4000);
  const mood = ["bright", "calm", "tender", "heavy"].includes(String(body.mood)) ? String(body.mood) : "calm";
  const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.occurredOn))
    ? String(body.occurredOn)
    : new Date().toISOString().slice(0, 10);
  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
  const record = { id: crypto.randomUUID(), userId: user.id, title, content, mood, occurredOn };
  await getDb().insert(lifeRecords).values(record);
  return NextResponse.json({ record }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing record id" }, { status: 400 });
  await getDb().delete(lifeRecords).where(and(eq(lifeRecords.id, id), eq(lifeRecords.userId, user.id)));
  return NextResponse.json({ success: true });
}
