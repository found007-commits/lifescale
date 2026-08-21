import type { Metadata } from "next";
import { headers } from "next/headers";
import { Experience } from "./components/Experience";
import { detectLocale } from "../lib/i18n";

export const metadata: Metadata = {
  title: "LifeScale 人生刻度 — 把余生，活成自己的作品",
  description: "看见时间、记录人生、珍惜关系，把重要的故事与牵挂好好留下。",
};

export default async function Home() {
  const requestHeaders = await headers();
  const country = requestHeaders.get("x-vercel-ip-country") || requestHeaders.get("cf-ipcountry") || "";
  const initialLocale = detectLocale(country, requestHeaders.get("accept-language"));
  return <Experience initialLocale={initialLocale} country={country} />;
}
