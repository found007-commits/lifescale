import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeScale 人生刻度",
    short_name: "LifeScale",
    description: "看见余生，认真今天。记录、回望并珍藏重要的人生时刻。",
    start_url: "/",
    display: "standalone",
    background_color: "#f2eee4",
    theme_color: "#143d2f",
    lang: "zh-CN",
    icons: [
      { src: "/lifescale-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: "/lifescale-icon.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}
