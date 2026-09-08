import { handleWechatAuth, wechatStatus, WechatAuthError } from "../../../../lib/wechat-auth-core";
import { requestBucket, wechatDependencies, wechatEnabled } from "../../../../lib/wechat-auth-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Pragma": "no-cache" };
const token = (request: Request) => /^Bearer (.+)$/.exec(request.headers.get("authorization") || "")?.[1] || null;
function failure(error: unknown) {
  // Never return upstream error objects: they can include credentials or account details.
  const safe = error instanceof WechatAuthError ? error : new WechatAuthError("WECHAT_UNAVAILABLE", 503);
  return Response.json({ error: safe.code, code: safe.code }, { status: safe.status, headers });
}
export async function GET(request: Request) {
  const accessToken = token(request);
  if (!accessToken) return Response.json({ enabled: wechatEnabled() }, { headers });
  try { return Response.json(await wechatStatus(accessToken, wechatDependencies()), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (!wechatEnabled()) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new WechatAuthError("INVALID_REQUEST", 415);
    const text = await request.text();
    if (text.length > 4096) throw new WechatAuthError("INVALID_REQUEST", 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new WechatAuthError("INVALID_REQUEST"); }
    return Response.json(await handleWechatAuth(body, token(request), requestBucket(request), wechatDependencies()), { headers });
  } catch (error) { return failure(error); }
}
