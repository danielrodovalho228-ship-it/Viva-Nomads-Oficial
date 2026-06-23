import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

/**
 * Web App Manifest (PWA). O Next injeta o <link rel="manifest"> automaticamente.
 * Ícones normais + maskable (Android/PWA), theme "night" e fundo branco.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "VivaNomads",
    description: "Locação mobiliada por temporada, de 30 a 180 dias.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
