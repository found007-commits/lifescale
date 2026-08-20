import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import { getDb } from "../db";
import * as schema from "../db/schema";
import { runtimeEnv } from "./runtime-env";

function socialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  const googleId = runtimeEnv("GOOGLE_CLIENT_ID");
  const googleSecret = runtimeEnv("GOOGLE_CLIENT_SECRET");
  const appleId = runtimeEnv("APPLE_CLIENT_ID");
  const appleSecret = runtimeEnv("APPLE_CLIENT_SECRET");
  const facebookId = runtimeEnv("FACEBOOK_CLIENT_ID");
  const facebookSecret = runtimeEnv("FACEBOOK_CLIENT_SECRET");

  if (googleId && googleSecret) providers.google = { clientId: googleId, clientSecret: googleSecret };
  if (appleId && appleSecret) providers.apple = { clientId: appleId, clientSecret: appleSecret };
  if (facebookId && facebookSecret) providers.facebook = { clientId: facebookId, clientSecret: facebookSecret };
  return providers;
}

async function sendOtp(email: string, otp: string) {
  const apiKey = runtimeEnv("RESEND_API_KEY");
  const from = runtimeEnv("EMAIL_FROM") || "LifeScale <hello@lifescale.space>";
  if (!apiKey) throw new Error("Email delivery is not configured yet.");
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: email,
    subject: `${otp} is your LifeScale code`,
    html: `<div style="font-family:system-ui;color:#173b2d;max-width:520px;margin:auto;padding:32px"><p style="letter-spacing:.16em;color:#c9912f">LIFESCALE</p><h1 style="font-weight:500">Your sign-in code</h1><p style="font-size:34px;letter-spacing:.28em;font-weight:700">${otp}</p><p>This code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p></div>`,
  });
  if (result.error) throw new Error(result.error.message);
}

export const auth = betterAuth({
  appName: "LifeScale",
  baseURL: runtimeEnv("BETTER_AUTH_URL") || "http://localhost:3000",
  secret: runtimeEnv("BETTER_AUTH_SECRET") || "development-only-lifescale-secret-change-me",
  trustedOrigins: [
    "https://app.lifescale.space",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    schema,
    transaction: false,
  }),
  socialProviders: socialProviders(),
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "apple", "facebook"] },
  },
  plugins: [
    bearer(),
    emailOTP({
      expiresIn: 600,
      allowedAttempts: 5,
      storeOTP: "hashed",
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp }) => sendOtp(email, otp),
    }),
  ],
  advanced: {
    useSecureCookies: runtimeEnv("BETTER_AUTH_URL").startsWith("https://"),
    database: { generateId: () => crypto.randomUUID() },
  },
});
