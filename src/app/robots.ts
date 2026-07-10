import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt — LIBERA todo o site público e bloqueia SÓ as áreas privadas /
 * internas. Nunca "Disallow: /" global (isso derrubava a indexação do nome da
 * marca). As rotas bloqueadas abaixo são: painel logado, área de admin, login,
 * API e os documentos internos (simulação de sócios, ROI, modelo de negócio,
 * sócios, decisão, preview de e-mails).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/auth",
        "/api",
        "/simulacao",
        "/roi",
        "/modelodenegocio",
        "/socios",
        "/decisao",
        "/dev",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
