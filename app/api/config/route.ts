import { NextResponse } from "next/server";
import { isConfigured } from "../../../lib/runtime-env";

export async function GET() {
  return NextResponse.json({
    providers: {
      google: isConfigured("GOOGLE_CLIENT_ID") && isConfigured("GOOGLE_CLIENT_SECRET"),
      apple: isConfigured("APPLE_CLIENT_ID") && isConfigured("APPLE_CLIENT_SECRET"),
      facebook: isConfigured("FACEBOOK_CLIENT_ID") && isConfigured("FACEBOOK_CLIENT_SECRET"),
      email: isConfigured("RESEND_API_KEY"),
    },
  });
}
