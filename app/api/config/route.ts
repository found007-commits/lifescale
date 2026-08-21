import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    providers: {
      google: false,
      apple: false,
      facebook: false,
      email: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    },
    storage: "supabase",
  });
}
