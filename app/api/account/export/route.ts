import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export async function GET(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const client = getSupabaseServerClient(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;
  const [profile, entries, checkins, reports] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("life_entries").select("*, entry_media(*)").eq("user_id", userId).order("entry_date"),
    client.from("checkins").select("*").eq("user_id", userId).order("checkin_date"),
    client.from("life_reports").select("*").eq("user_id", userId).order("created_at"),
  ]);
  const firstError = profile.error || entries.error || checkins.error || reports.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 500 });
  return Response.json({ exported_at: new Date().toISOString(), account: { id: userId, email: userData.user.email }, profile: profile.data, entries: entries.data, checkins: checkins.data, reports: reports.data });
}
