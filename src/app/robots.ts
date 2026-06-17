import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** robots.txt — indexa páginas públicas, bloqueia áreas privadas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/auth", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
