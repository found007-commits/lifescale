import "server-only";
import { createHmac } from "node:crypto";
import { getSupabaseAdminClient, getSupabaseServerClient } from "./supabase/server";
import { hash, WechatAuthError, type WechatAuthDependencies, type LoginSession } from "./wechat-auth-core";

export const WECHAT_APP_ID = "wxa1ad4ff408b7727d";
export function wechatEnabled() {
  return process.env.WECHAT_LOGIN_ENABLED === "true" && Boolean(process.env.WECHAT_MINIPROGRAM_APP_SECRET?.trim());
}
export function requestBucket(request: Request) {
  const ip = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  return createHmac("sha256", process.env.WECHAT_MINIPROGRAM_APP_SECRET || "disabled").update(ip.trim()).digest("hex");
}
export function wechatDependencies(): WechatAuthDependencies {
  const admin = getSupabaseAdminClient();
  const publicAuth = () => getSupabaseServerClient();
  async function findIdentity(subject: string) {
    const { data, error } = await admin.from("wechat_identities").select("user_id").eq("app_id", WECHAT_APP_ID).eq("subject_hash", subject).maybeSingle();
    if (error) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
    return data?.user_id || null;
  }
  return {
    enabled: wechatEnabled(),
    async allow(bucket, limit, seconds) {
      const { data, error } = await admin.rpc("wechat_auth_allow", { p_bucket: bucket, p_limit: limit, p_seconds: seconds });
      if (error) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
      return data === true;
    },
    async exchange(code) {
      const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
      url.search = new URLSearchParams({ appid: WECHAT_APP_ID, secret: process.env.WECHAT_MINIPROGRAM_APP_SECRET!.trim(), js_code: code, grant_type: "authorization_code" }).toString();
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const body = await response.json();
        if ([40029, 40163].includes(Number(body.errcode))) throw new WechatAuthError("WECHAT_CODE_EXPIRED", 401);
        if (!response.ok || body.errcode || typeof body.openid !== "string" || !body.openid || body.openid.length > 128) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
        // Discard session_key and UnionID; neither is needed for our account mapping.
        return hash(WECHAT_APP_ID + ":" + body.openid);
      } catch (error) { throw error instanceof WechatAuthError ? error : new WechatAuthError("WECHAT_UNAVAILABLE", 503); }
    },
    findIdentity,
    async isBound(userId) {
      const { data, error } = await admin.from("wechat_identities").select("user_id").eq("app_id", WECHAT_APP_ID).eq("user_id", userId).maybeSingle();
      if (error) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
      return Boolean(data);
    },
    async authenticate(token) {
      const { data, error } = await publicAuth().auth.getUser(token);
      return error ? null : data.user;
    },
    async verifyEmail(email, otp) {
      const { data, error } = await publicAuth().auth.verifyOtp({ email, token: otp, type: "email" });
      if (error || !data.session) throw new WechatAuthError("EMAIL_VERIFY_FAILED", 401);
      return data.session as LoginSession;
    },
    async createUser(subject) {
      const email = subject + "@wechat.lifescale.invalid";
      // A stable reserved identity makes a retry recoverable without creating duplicates.
      const existing = await admin.rpc("wechat_reserved_user", { p_subject: subject });
      if (existing.error) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
      if (existing.data) {
        const found = await admin.auth.admin.getUserById(existing.data);
        if (found.error || !found.data.user) throw new WechatAuthError("LOGIN_RETRY", 409);
        return found.data.user;
      }
      const created = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { lifescale_wechat_subject: subject, privacy_version: "2026-09-08" } });
      if (!created.error && created.data.user) return created.data.user;
      const retry = await admin.rpc("wechat_reserved_user", { p_subject: subject });
      if (retry.error || !retry.data) throw new WechatAuthError("LOGIN_RETRY", 409);
      const found = await admin.auth.admin.getUserById(retry.data);
      if (found.error || !found.data.user) throw new WechatAuthError("LOGIN_RETRY", 409);
      return found.data.user;
    },
    async link(subject, userId) {
      const existing = await findIdentity(subject);
      if (existing) return existing === userId;
      const { error } = await admin.from("wechat_identities").insert({ app_id: WECHAT_APP_ID, subject_hash: subject, user_id: userId });
      if (!error) return true;
      if (error.code !== "23505") throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
      return await findIdentity(subject) === userId;
    },
    async unlink(userId) {
      const { error } = await admin.from("wechat_identities").delete().eq("app_id", WECHAT_APP_ID).eq("user_id", userId);
      if (error) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
    },
    async issueSession(userId) {
      const found = await admin.auth.admin.getUserById(userId);
      const user = found.data.user;
      if (found.error || !user?.email || user.factors?.some(factor => factor.status === "verified")) throw new WechatAuthError("USE_EMAIL_LOGIN", 403);
      // Admin-generated tokens never leave this server. Verify them here to create a
      // normal Supabase session: existing RLS and refresh-token handling remain intact.
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
      if (link.error || link.data.user?.id !== userId || !link.data.properties?.hashed_token) throw new WechatAuthError("LOGIN_RETRY", 503);
      const verified = await publicAuth().auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
      if (verified.error || !verified.data.session || verified.data.user?.id !== userId) throw new WechatAuthError("LOGIN_RETRY", 503);
      return verified.data.session as LoginSession;
    },
  };
}
