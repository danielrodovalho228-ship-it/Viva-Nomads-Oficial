import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { AREAS_PRIVADAS, BOTS_DE_IA } from "@/lib/seo/robots-regras";

/**
 * robots.txt — LIBERA todo o site público e bloqueia SÓ as áreas privadas /
 * internas. Nunca "Disallow: /" global (isso derrubava a indexação do nome da
 * marca). As rotas bloqueadas abaixo são: painel logado, área de admin, login,
 * API e os documentos internos (simulação de sócios, ROI, modelo de negócio,
 * sócios, decisão, preview de e-mails).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Buscadores de IA liberados de forma explícita (ordem 9f68d9d3). Um grupo
      // próprio repete o bloqueio das áreas privadas: nos robots.txt, o bot que
      // tem grupo nomeado ignora o grupo "*".
      { userAgent: BOTS_DE_IA, allow: "/", disallow: AREAS_PRIVADAS },
      { userAgent: "*", allow: "/", disallow: AREAS_PRIVADAS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
