import { createHash } from "node:crypto";
import { getSupabaseAdminClient, getSupabaseServerClient } from "../../../../lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function DELETE(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = getSupabaseServerClient(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const admin = getSupabaseAdminClient();
    const requestId = crypto.randomUUID();
    const emailHash = createHash("sha256").update(data.user.email.toLowerCase()).digest("hex");
    const { data: media } = await admin.from("entry_media").select("storage_path").eq("user_id", data.user.id);
    const paths = (media || []).map((item) => item.storage_path as string);
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from("entry-media").remove(paths);
      if (storageError) return Response.json({ error: "Could not remove stored images." }, { status: 500 });
    }
    await admin.from("account_deletion_requests").insert({ id: requestId, user_id: data.user.id, email_hash: emailHash, status: "requested" });
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      await admin.from("account_deletion_requests").update({ status: "failed" }).eq("id", requestId);
      return Response.json({ error: deleteError.message }, { status: 500 });
    }
    await admin.from("account_deletion_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", requestId);
    return Response.json({ ok: true });
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : "Account deletion failed." }, { status: 500 });
  }
}
