import type { Metadata } from "next";
import { headers } from "next/headers";
import { Experience } from "./components/Experience";
import { detectLocale } from "../lib/i18n";

export const metadata: Metadata = {
  title: "余生有刻 LifeScale｜看见余生，认真今天",
  description: "余生有刻帮助你看见人生进度、记录每个值得留下的今天，并逐步建立属于自己的人生档案。",
};

export default async function Home() {
  const requestHeaders = await headers();
  const country = requestHeaders.get("x-vercel-ip-country") || requestHeaders.get("cf-ipcountry") || "";
  const initialLocale = detectLocale(country, requestHeaders.get("accept-language"));
  return <Experience initialLocale={initialLocale} country={country} />;
}
