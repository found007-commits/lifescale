import type { Metadata } from "next";
import { headers } from "next/headers";
import { Experience } from "./components/Experience";
import { detectLocale } from "../lib/i18n";

export const metadata: Metadata = {
  title: "LifeScale — Make your time your own",
  description: "See the life ahead, keep the moments behind, and remember what deserves your attention today.",
};

export default async function Home() {
  const requestHeaders = await headers();
  const country = requestHeaders.get("cf-ipcountry") ?? requestHeaders.get("x-vercel-ip-country");
  const locale = detectLocale(country, requestHeaders.get("accept-language"));
  return <Experience initialLocale={locale} country={country ?? ""} />;
}
