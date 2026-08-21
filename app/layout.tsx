import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LifeScale 人生刻度 — 把余生，活成自己的作品",
    template: "%s · LifeScale",
  },
  description: "看见时间、记录人生、珍惜关系，把重要的故事与牵挂好好留下。",
  icons: {
    icon: "/lifescale-icon.png",
    shortcut: "/lifescale-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LifeScale",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased`}
      >
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
