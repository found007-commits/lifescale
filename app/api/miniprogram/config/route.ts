import { NextResponse } from "next/server";
import { detectLocale } from "../../../../lib/i18n";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl?.startsWith("https://") || !publishableKey) {
    return NextResponse.json({ error: "Mini program configuration is unavailable." }, { status: 503 });
  }

  return NextResponse.json(
    { supabaseUrl, publishableKey, locale: detectLocale(request.headers.get("x-vercel-ip-country"), request.headers.get("accept-language")) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
