import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { absoluteMediaUrl, loadDashboardBootstrap } from "../../../../lib/dashboard-bootstrap";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache" };

// Everything the dashboard shows on first paint, in one request. The caller's own token is
// forwarded to Supabase, so RLS still decides which rows come back; this only collapses the
// four sequential round trips a cold start used to need.
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const client = getSupabaseServerClient(accessToken);
    const { data: userData, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !userData?.user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const payload = await loadDashboardBootstrap(userData.user.id, userData.user.email ?? null, {
      profile: async (userId) => {
        const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (error) throw error;
        return (data ?? null) as { [key: string]: unknown } | null;
      },
      entries: async (userId, limit) => {
        const { data, error } = await client.from("life_entries").select("*, entry_media(*)")
          .eq("user_id", userId).order("entry_date", { ascending: false }).order("id", { ascending: false }).limit(limit);
        if (error) throw error;
        return (data ?? []) as never[];
      },
      checkins: async (userId, limit) => {
        const { data, error } = await client.from("checkins").select("*")
          .eq("user_id", userId).order("checkin_date", { ascending: false }).limit(limit);
        if (error) throw error;
        return (data ?? []) as { [key: string]: unknown }[];
      },
      checkinCount: async (userId) => {
        const { count, error } = await client.from("checkins").select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (error || typeof count !== "number") throw error || new Error("COUNT_UNAVAILABLE");
        return count;
      },
      signMedia: async (paths, expiresIn) => {
        const { data, error } = await client.storage.from("entry-media").createSignedUrls(paths, expiresIn);
        if (error) throw error;
        return (data ?? []).map(item => ({ path: item.path, signedUrl: absoluteMediaUrl(item.signedUrl, supabaseUrl) }));
      },
    }, supabaseUrl);
    return Response.json(payload, { headers });
  } catch {
    // Never return upstream error objects: they can include credentials or account details.
    return Response.json({ error: "BOOTSTRAP_UNAVAILABLE" }, { status: 500, headers });
  }
}
