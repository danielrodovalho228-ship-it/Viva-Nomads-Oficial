"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Fundo de vídeo do hero da /home (Fase 1). O POSTER é a imagem de LCP (pinta
 * primeiro, via next/image priority); o vídeo assume por cima quando carrega.
 * Só monta o <video> em telas >= 640px e sem prefers-reduced-motion — no mobile
 * e com movimento reduzido, fica só o poster (economia de dados e acessibilidade).
 * A camada escura por cima mantém o texto do hero legível.
 */
export function HeroVideoBg() {
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
      {/* Poster = LCP */}
      <Image
        src="/media/hero-home-poster.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {showVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/hero-home-poster.webp"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/media/hero-home.mp4" type="video/mp4" />
        </video>
      )}
      {/* Camada escura por cima (legibilidade do texto). */}
      <div className="absolute inset-0 bg-night/70" />
    </div>
  );
}
