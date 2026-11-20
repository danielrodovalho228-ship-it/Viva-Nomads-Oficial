"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { BOTOES_DO_FIM, INICIO_DO_CARTAO_FINAL } from "./video-dados";

/**
 * Vídeo institucional v3 ("A Viva em 30 segundos"). Player nativo, PARADO e com som: só toca quando a
 * pessoa clica no play (nada de autoplay). Legenda em pt-BR ligada por padrão.
 * D-V (22/10, o play demorava a começar): 720p a ~0,6 Mb/s (2,5 MB, era 1080p e 5 MB) e, no celular, 540p
 * (1,6 MB); os dois com o índice no começo do arquivo (faststart). preload="none" baixa só o cabeçalho
 * (alguns KB) para o play começar na hora, sem baixar o vídeo antes.
 *
 * E295 (Daniel, uso real no celular, 31/10): só a APRESENTAÇÃO muda — o conteúdo do vídeo é congelado. A capa era o
 * cartão final branco (logo, botões, URL) e o play nativo, cinza, sumia nela: não se percebia que era um vídeo.
 * Agora: moldura (borda), capa = um quadro do meio do próprio vídeo (12,5 s, "Imóveis mobiliados"), botão de play
 * grande no verde da marca com anel branco de contraste, selo com a duração, 16:9. O toque no play dá o play no
 * vídeo; a partir daí ficam os controles nativos.
 *
 * E832: os botões do cartão final ("Encontrar meu lar" / "Anunciar grátis") são parte da imagem. Quando o cartão final
 * aparece (25,6 s) e quando o vídeo termina, dois links REAIS ficam por cima deles; somem se a pessoa voltar o vídeo.
 */
export const VIDEO_INSTITUCIONAL = {
  mp4: "/media/institucional.mp4",
  mp4Celular: "/media/institucional-540.mp4",
  /** Quadro do meio do vídeo (12,5 s), extraído do próprio institucional.mp4 — nunca o cartão final. */
  poster: "/media/institucional-poster.webp",
  legenda: "/media/institucional.pt-BR.vtt",
  /** E832: duração real do arquivo (32,6 s) como os players mostram — segundos INTEIROS, sem arredondar para cima
   *  (era "0:33" e o player mostrava 0:32). */
  duracao: "0:32",
} as const;

export function VideoInstitucional({ titulo = "A Viva em 30 segundos", id = "video-institucional" }: { titulo?: string; id?: string }) {
  const tituloId = `${id}-titulo`;
  const video = useRef<HTMLVideoElement>(null);
  const [tocou, setTocou] = useState(false);
  const [fim, setFim] = useState(false);

  function tocar() {
    setTocou(true);
    void video.current?.play().catch(() => undefined);
  }

  return (
    <section aria-labelledby={tituloId} data-testid="secao-video-institucional" className="container-page section-y">
      <h2 id={tituloId} className="font-title font-semibold text-ink display-lg">
        {titulo}
      </h2>
      {/* E295: moldura (borda da marca) em volta do player; a capa cobre a caixa toda, sem fundo aparecendo. */}
      <div
        className="relative mt-4 aspect-video overflow-hidden rounded-xl border-2 border-line bg-white"
        data-testid="video-institucional-caixa"
      >
        <video
          ref={video}
          data-testid="video-institucional"
          className="absolute inset-0 h-full w-full object-cover"
          // E295: antes do play a capa é limpa (os controles nativos — "0:00" e a faixa escura — cobriam a legenda do
          // quadro); depois do toque, os controles nativos de sempre.
          controls={tocou}
          preload="none"
          playsInline
          poster={VIDEO_INSTITUCIONAL.poster}
          aria-label="Vídeo institucional da Viva Nomads: como funciona, em 30 segundos"
          onPlay={() => setTocou(true)}
          onTimeUpdate={(e) => setFim(e.currentTarget.currentTime >= INICIO_DO_CARTAO_FINAL)}
          onEnded={() => setFim(true)}
        >
          <source src={VIDEO_INSTITUCIONAL.mp4Celular} type="video/mp4" media="(max-width: 767px)" />
          <source src={VIDEO_INSTITUCIONAL.mp4} type="video/mp4" />
          <track kind="captions" srcLang="pt-BR" label="Português (Brasil)" src={VIDEO_INSTITUCIONAL.legenda} default />
        </video>
        {fim && (
          <div data-testid="video-institucional-fim">
            {BOTOES_DO_FIM.map((b) => (
              <Link
                key={b.href}
                href={b.href}
                className={`absolute grid place-items-center rounded-full text-[clamp(0.75rem,2.2vw,1.5rem)] font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${b.cor === "azul" ? "bg-[#00288c]" : "bg-[#3c6e08]"}`}
                style={{ left: `${b.caixa.esquerda}%`, top: `${b.caixa.topo}%`, width: `${b.caixa.largura}%`, height: `${b.caixa.altura}%` }}
                data-testid={`video-institucional-fim-${b.cor}`}
              >
                {b.rotulo}
              </Link>
            ))}
          </div>
        )}
        {!tocou && (
          <button
            type="button"
            onClick={tocar}
            className="group absolute inset-0 grid place-items-center bg-night/20 transition-colors hover:bg-night/10 focus-visible:outline-none"
            aria-label={`Assistir ao vídeo "${titulo}" (${VIDEO_INSTITUCIONAL.duracao})`}
            data-testid="video-institucional-play"
          >
            <span
              className="grid h-16 w-16 place-items-center rounded-full bg-forest text-white ring-4 ring-white transition-transform group-hover:scale-105 group-focus-visible:ring-8 md:h-20 md:w-20"
              aria-hidden
            >
              <Play className="ml-1 h-7 w-7 fill-white md:h-9 md:w-9" />
            </span>
            <span
              className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold tabular-nums text-white"
              data-testid="video-institucional-duracao"
              aria-hidden
            >
              {VIDEO_INSTITUCIONAL.duracao}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
