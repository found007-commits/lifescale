import { createHash } from "node:crypto";

export class WechatAuthError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export type AuthUser = { id: string; email?: string; email_confirmed_at?: string; factors?: { status?: string }[] };
export type LoginSession = { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string; user: AuthUser };
export interface WechatAuthDependencies {
  enabled: boolean;
  allow(bucket: string, limit: number, seconds: number): Promise<boolean>;
  exchange(code: string): Promise<string>;
  findIdentity(subject: string): Promise<string | null>;
  isBound(userId: string): Promise<boolean>;
  authenticate(token: string): Promise<AuthUser | null>;
  verifyEmail(email: string, otp: string): Promise<LoginSession>;
  createUser(subject: string): Promise<AuthUser>;
  link(subject: string, userId: string): Promise<boolean>;
  unlink(userId: string): Promise<void>;
  issueSession(userId: string): Promise<LoginSession>;
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const internalEmail = (email?: string) => !email || email.toLowerCase().endsWith("@wechat.lifescale.invalid");

function requiredString(value: unknown, min: number, max: number) {
  if (typeof value !== "string" || value.length < min || value.length > max) throw new WechatAuthError("INVALID_REQUEST");
  return value;
}
function noMfaBypass(user: AuthUser) {
  if (user.factors?.some(factor => factor.status === "verified")) throw new WechatAuthError("USE_EMAIL_LOGIN", 403);
}

export async function wechatStatus(token: string, deps: WechatAuthDependencies) {
  const user = await deps.authenticate(token);
  if (!user) throw new WechatAuthError("UNAUTHORIZED", 401);
  return { enabled: deps.enabled, bound: deps.enabled ? await deps.isBound(user.id) : false, canUnbind: !internalEmail(user.email) };
}

export async function handleWechatAuth(input: unknown, bearer: string | null, ipBucket: string, deps: WechatAuthDependencies) {
  if (!deps.enabled) throw new WechatAuthError("WECHAT_UNAVAILABLE", 503);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WechatAuthError("INVALID_REQUEST");
  const body = input as Record<string, unknown>;
  if (body.agreed !== true) throw new WechatAuthError("CONSENT_REQUIRED", 403);
  if (!["login", "create", "bind", "unbind"].includes(String(body.action))) throw new WechatAuthError("INVALID_REQUEST");
  if (!await deps.allow("ip:" + ipBucket, 30, 60)) throw new WechatAuthError("TRY_LATER", 429);

  if (body.action === "unbind") {
    const current = bearer ? await deps.authenticate(bearer) : null;
    if (!current) throw new WechatAuthError("UNAUTHORIZED", 401);
    if (internalEmail(current.email)) throw new WechatAuthError("LAST_LOGIN_METHOD", 409);
    const email = requiredString(body.email, 3, 254).trim().toLowerCase();
    const otp = requiredString(body.otp, 6, 6);
    if (!/^\d{6}$/.test(otp) || email !== current.email?.toLowerCase()) throw new WechatAuthError("ACCOUNT_MISMATCH", 409);
    const session = await deps.verifyEmail(email, otp);
    if (session.user.id !== current.id) throw new WechatAuthError("ACCOUNT_MISMATCH", 409);
    noMfaBypass(session.user);
    await deps.unlink(current.id);
    return { session, unbound: true };
  }

  const code = requiredString(body.code, 1, 256);
  // wx.login codes are single-use; this also rejects replay across our own instances.
  if (!await deps.allow("code:" + hash(code), 1, 300)) throw new WechatAuthError("WECHAT_CODE_EXPIRED", 401);
  const subject = await deps.exchange(code);
  if (!await deps.allow("subject:" + subject, 12, 60)) throw new WechatAuthError("TRY_LATER", 429);

  if (body.action === "bind") {
    const email = requiredString(body.email, 3, 254).trim().toLowerCase();
    const otp = requiredString(body.otp, 6, 6);
    if (!/^\d{6}$/.test(otp) || internalEmail(email)) throw new WechatAuthError("INVALID_REQUEST");
    const session = await deps.verifyEmail(email, otp);
    if (!session.user.email_confirmed_at || session.user.email?.toLowerCase() !== email) throw new WechatAuthError("EMAIL_VERIFY_FAILED", 401);
    noMfaBypass(session.user);
    if (bearer) {
      const current = await deps.authenticate(bearer);
      if (!current || current.id !== session.user.id) throw new WechatAuthError("ACCOUNT_MISMATCH", 409);
    }
    const linked = await deps.link(subject, session.user.id);
    // Conflict never changes a binding or returns the other person's account.
    // The verified email session still lets the user open their original records.
    return { session, bindingConflict: !linked, bound: linked };
  }

  let userId = await deps.findIdentity(subject);
  if (!userId && body.action === "login") return { needsAccountChoice: true };
  if (!userId) {
    if (body.newAccountConfirmed !== true) throw new WechatAuthError("NEW_ACCOUNT_CONFIRM_REQUIRED", 403);
    const created = await deps.createUser(subject);
    await deps.link(subject, created.id);
    // Resolve the unique mapping after concurrent create/bind requests. Never overwrite it.
    userId = await deps.findIdentity(subject);
    if (!userId) throw new WechatAuthError("LOGIN_RETRY", 409);
  }
  const session = await deps.issueSession(userId);
  if (session.user.id !== userId) throw new WechatAuthError("SESSION_MISMATCH", 500);
  noMfaBypass(session.user);
  if (await deps.findIdentity(subject) !== userId) throw new WechatAuthError("LOGIN_RETRY", 409);
  return { session };
}
