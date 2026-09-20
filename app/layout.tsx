import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.lifescale.space"),
  title: {
    default: "余生有刻 LifeScale｜看见余生，认真今天",
    template: "%s｜余生有刻",
  },
  description: "余生有刻帮助你看见人生进度、记录每个值得留下的今天，并逐步建立属于自己的人生档案。",
  icons: {
    icon: "/lifescale-icon.png",
    shortcut: "/lifescale-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "余生有刻",
  },
  openGraph: {
    type: "website",
    title: "余生有刻 LifeScale｜看见余生，认真今天",
    description: "看见人生进度，记录每个值得留下的今天，建立属于自己的人生档案。",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "余生有刻：看见余生，认真今天。" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "余生有刻 LifeScale｜看见余生，认真今天",
    description: "看见人生进度，记录每个值得留下的今天，建立属于自己的人生档案。",
    images: ["/og.png"],
  },
};

// Applied before the first paint, so a reader who chose dark never sees a white flash. Until
// 2.0.13 the only thing that set data-theme was useTheme(), which runs in an effect - so routes
// that never call it (the four legal pages: /privacy, /terms, /third-parties,
// /account-deletion) had no theme at all and stayed light whatever the reader had chosen.
// Reading the same key here means those pages now follow the choice instead of ignoring it.
const THEME_INIT = `(function(){try{var k="lifescale:theme";var s=window.localStorage.getItem(k);var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        className={`${geistSans.variable} antialiased`}
      >
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
