"use client";

import { useEffect, useState } from "react";
import { preload } from "react-dom";

/**
 * Fundo de vídeo do hero da /home (Fase 1). O POSTER é a imagem de LCP; o vídeo assume por cima quando carrega.
 * D-V (relato do Daniel no celular, 22/10): o topo abria como bloco preto por segundos. Agora: (1) uma prévia borrada
 * de ~120 bytes vem embutida no HTML e pinta junto com a página; (2) o poster sai direto do /media (sem o otimizador,
 * que gerava a imagem na 1ª visita), 15 KB no celular / 40 KB no computador, com preload no <head> e
 * fetchPriority="high".
 * Só monta o <video> em telas >= 640px e sem prefers-reduced-motion — no mobile
 * e com movimento reduzido, fica só o poster (economia de dados e acessibilidade).
 * A camada escura por cima mantém o texto do hero legível.
 */
export const HERO_POSTER = { celular: "/media/hero-home-poster-768.webp", computador: "/media/hero-home-poster.webp" } as const;
const HERO_SRCSET = `${HERO_POSTER.celular} 768w, ${HERO_POSTER.computador} 1280w`;
/** 24×14 px, borrada (sharp), ~120 bytes: pinta na 1ª renderização, antes de qualquer download. */
export const HERO_PREVIA =
  "data:image/webp;base64,UklGRnAAAABXRUJQVlA4IGQAAADwAwCdASoYAA4APu1iqk2ppaQiMAgBMB2JQBOmUABOrK7L63hS2BYuAP46abFwsl4r1UlLp3CZhwIwAO/z5BgkIgjEytSu0c9DUGoi1TLSsVtaMOGpZgOlCarhmshU+8pFiIAA";

export function HeroVideoBg() {
  // <link rel="preload"> no <head> já no HTML do servidor: o navegador busca o poster antes de montar a página.
  preload(HERO_POSTER.computador, { as: "image", imageSrcSet: HERO_SRCSET, imageSizes: "100vw", fetchPriority: "high" });
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mqWidth = window.matchMedia("(min-width: 640px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setShowVideo(mqWidth.matches && !mqMotion.matches);
    // Defere para fora do corpo síncrono do efeito (sem cascata de render).
    const id = requestAnimationFrame(update);
    mqWidth.addEventListener("change", update);
    mqMotion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(id);
      mqWidth.removeEventListener("change", update);
      mqMotion.removeEventListener("change", update);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Prévia borrada (no HTML, sem rede) por baixo do poster: o topo nunca abre preto. */}
      <div className="absolute inset-0 scale-110 bg-cover bg-center blur-lg" style={{ backgroundImage: `url(${HERO_PREVIA})` }} data-testid="hero-previa" />
      {/* Poster = LCP */}
      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo estático já no tamanho certo; o otimizador atrasava a 1ª pintura */}
      <img
        src={HERO_POSTER.computador}
        srcSet={HERO_SRCSET}
        sizes="100vw"
        alt=""
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        data-testid="hero-poster"
      />
      {showVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_POSTER.computador}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/media/hero-home.mp4" type="video/mp4" />
        </video>
      )}
      {/* Camada escura por cima (legibilidade do texto). */}
      <div className="absolute inset-0 bg-night/60" />
    </div>
  );
}
