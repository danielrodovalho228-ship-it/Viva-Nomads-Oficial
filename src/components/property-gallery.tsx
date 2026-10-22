"use client";

import { useEffect, useRef, useState } from "react";
import { X, Images, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { ITEM_VIDEO, itensDaGaleria } from "@/lib/video-tour";
import { ROTULO_SELO_VIDEO } from "@/lib/card-selos";
import { VideoModal } from "@/components/video-walkthrough";

/** O mosaico mostra 5 fotos (0–4); o "+N mais" abre na primeira oculta. */
export const PRIMEIRA_FOTO_OCULTA = 5;

const isPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/**
 * Galeria adaptável (rodada 11; Prompt 41, item 1) — sem altura fixa nem vão vazio.
 * - Celular: carrossel em TELA CHEIA (de borda a borda, sem raio), indicador "1/12" e, por cima, o coração e o
 *   compartilhar como ÍCONES (`acoes`).
 * - Computador: mosaico de 5 (1 foto grande + 4) que se ajusta à quantidade, com "Ver todas as fotos".
 * - "Ver todas" abre um lightbox com todas as fotos.
 */
export function PropertyGallery({
  photos,
  title,
  readyToLive,
  videoUrl,
  acoes,
}: {
  photos: string[];
  title: string;
  readyToLive?: boolean;
  /** Tour em vídeo: vira a 1ª peça (ordem 6f964617, tela 7). */
  videoUrl?: string;
  /** Ícones sobre a foto no celular (coração e compartilhar). */
  acoes?: React.ReactNode;
}) {
  const [lightbox, setLightbox] = useState(false);
  const [videoAberto, setVideoAberto] = useState(false);
  const [index, setIndex] = useState(0);
  const fotos = photos.length ? photos : [""];
  const list = itensDaGaleria(fotos, videoUrl);
  const temVideo = list[0] === ITEM_VIDEO;

  // O vídeo abre na janela própria; o lightbox só tem fotos (índice sem o vídeo).
  function openAt(i: number) {
    if (list[i] === ITEM_VIDEO) {
      setVideoAberto(true);
      return;
    }
    setIndex(temVideo ? i - 1 : i);
    setLightbox(true);
  }

  return (
    <>
      {/* ── Mobile: carrossel ── */}
      <MobileCarousel photos={list} title={title} readyToLive={readyToLive} onOpen={openAt} capa={fotos[0]} acoes={acoes} />

      {/* ── Desktop: mosaico adaptável ── */}
      <DesktopMosaic
        photos={list}
        title={title}
        readyToLive={readyToLive}
        onOpen={openAt}
        capa={fotos[0]}
      />

      {videoAberto && videoUrl && (
        <VideoModal url={videoUrl} title={title} onClose={() => setVideoAberto(false)} />
      )}

      {lightbox && (
        <Lightbox
          photos={fotos}
          title={title}
          index={index}
          setIndex={setIndex}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}

function Tile({
  src,
  alt,
  className,
  onClick,
  testId,
  capa,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  testId?: string;
  /** Capa do vídeo (a 1ª foto), usada só quando src é o vídeo. */
  capa?: string;
}) {
  if (src === ITEM_VIDEO) {
    return (
      <button
        type="button"
        data-testid={testId ?? "galeria-video"}
        onClick={onClick}
        aria-label={`${ROTULO_SELO_VIDEO}: ${alt}`}
        className={cn("group relative block overflow-hidden bg-night", className)}
      >
        {isPhoto(capa) && (
          <BrandImage
            src={capa as string}
            alt={alt}
            treat={false}
            rounded="rounded-none"
            sizes="(max-width: 768px) 100vw, 50vw"
            className="h-full w-full opacity-80 transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
          <PlayCircle className="h-14 w-14" aria-hidden />
          <span className="rounded-full bg-night/80 px-3 py-1 text-sm font-semibold">{ROTULO_SELO_VIDEO}</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn("group relative block overflow-hidden", className)}
    >
      {isPhoto(src) ? (
        <BrandImage
          src={src}
          alt={alt}
          treat={false}
          rounded="rounded-none"
          sizes="(max-width: 768px) 100vw, 50vw"
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <PhotoPlaceholder label={src} className="h-full w-full" />
      )}
    </button>
  );
}

function MobileCarousel({
  photos,
  title,
  readyToLive,
  onOpen,
  capa,
  acoes,
}: {
  photos: string[];
  title: string;
  readyToLive?: boolean;
  onOpen: (i: number) => void;
  capa?: string;
  acoes?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  return (
    // Tela cheia: sai do recuo da página (px-5 / sm:px-8) e encosta no topo; sem raio.
    <div className="relative -mx-4 -mt-8 sm:-mx-8 md:hidden" data-testid="galeria-celular">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((p, i) => (
          <div key={i} className="aspect-[4/3] w-full shrink-0 snap-center">
            <Tile src={p} alt={`${title} — foto ${i + 1}`} className="h-full w-full" onClick={() => onOpen(i)} capa={capa} testId={`galeria-tile-${i}`} />
          </div>
        ))}
      </div>
      {readyToLive && (
        <div className="pointer-events-none absolute left-3 top-3">
          <ReadyToLiveBadge size="sm" />
        </div>
      )}
      {acoes && (
        <div className="absolute right-3 top-3 flex items-center gap-2" data-testid="galeria-acoes">
          {acoes}
        </div>
      )}
      <span data-testid="galeria-indicador" className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-night/70 px-3 py-1 text-xs font-semibold tabular-nums text-white">
        {active + 1}/{photos.length}
      </span>
    </div>
  );
}

function DesktopMosaic({
  photos,
  title,
  readyToLive,
  onOpen,
  capa,
}: {
  photos: string[];
  title: string;
  readyToLive?: boolean;
  onOpen: (i: number) => void;
  capa?: string;
}) {
  const n = photos.length;

  // 1 foto: ocupa tudo. 2–4: principal + coluna. 5+: mosaico clássico.
  let content: React.ReactNode;
  if (n === 1) {
    content = (
      <div className="h-[480px] overflow-hidden rounded-xl">
        <Tile src={photos[0]} alt={title} className="h-full w-full" onClick={() => onOpen(0)} capa={capa} testId="galeria-tile-0" />
      </div>
    );
  } else if (n < 5) {
    content = (
      <div className="grid h-[480px] grid-cols-3 gap-2 overflow-hidden rounded-xl">
        <Tile src={photos[0]} alt={title} className="col-span-2 row-span-1 h-full" onClick={() => onOpen(0)} capa={capa} testId="galeria-tile-0" />
        <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${n - 1}, minmax(0, 1fr))` }}>
          {photos.slice(1).map((p, i) => (
            <Tile key={i} src={p} alt={`${title} — ${i + 2}`} className="h-full" onClick={() => onOpen(i + 1)} capa={capa} testId={`galeria-tile-${i + 1}`} />
          ))}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="grid h-[480px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl">
        <Tile src={photos[0]} alt={title} className="col-span-2 row-span-2 h-full" onClick={() => onOpen(0)} capa={capa} testId="galeria-tile-0" />
        {photos.slice(1, 5).map((p, i) => {
          const isLast = i === 3 && n > 5;
          return (
            <div key={i} className="relative h-full">
              <Tile src={p} alt={`${title} — ${i + 2}`} className="h-full w-full" onClick={() => onOpen(i + 1)} capa={capa} testId={`galeria-tile-${i + 1}`} />
              {isLast && (
                <button
                  type="button"
                  data-testid="galeria-mais"
                  onClick={() => onOpen(PRIMEIRA_FOTO_OCULTA)}
                  className="absolute left-2 top-2 inline-flex min-h-9 items-center gap-2 rounded-full bg-white/95 px-3 text-sm font-semibold text-ink hover:bg-white"
                >
                  <Images className="h-4 w-4" /> +{n - 5} mais
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative hidden md:block" data-testid="galeria-mosaico">
      {content}
      {readyToLive && (
        <div className="pointer-events-none absolute left-4 top-4">
          <ReadyToLiveBadge />
        </div>
      )}
      <button
        type="button"
        data-testid="galeria-ver-todas"
        onClick={() => onOpen(0)}
        className="absolute bottom-4 right-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-2"
      >
        <Images className="h-4 w-4" /> Ver todas as fotos
      </button>
    </div>
  );
}

function Lightbox({
  photos,
  title,
  index,
  setIndex,
  onClose,
}: {
  photos: string[];
  title: string;
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) {
  const prev = () => setIndex((index - 1 + photos.length) % photos.length);
  const next = () => setIndex((index + 1) % photos.length);

  // Teclado (desktop/a11y): ←/→ navegam, Esc fecha.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  // Swipe em tela cheia (mobile): arrasto horizontal > 40px troca a foto.
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null || photos.length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    if (dx > 40) prev();
    else if (dx < -40) next();
    touchX.current = null;
  }

  return (
    <div
      data-testid="galeria-lightbox"
      className="fixed inset-0 z-50 flex flex-col bg-night/95"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm" data-testid="galeria-contador">
          {index + 1} / {photos.length}
        </span>
        <IconButton onClick={onClose} label="Fechar" icon={X} iconClassName="h-6 w-6" className="h-10 w-10 text-white hover:bg-white/10" />
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
        {photos.length > 1 && (
          <IconButton onClick={prev} label="Foto anterior" icon={ChevronLeft} iconClassName="h-6 w-6" className="absolute left-4 z-10 h-11 w-11 bg-white/10 text-white hover:bg-white/20" />
        )}
        <div className="w-full max-w-4xl">
          {isPhoto(photos[index]) ? (
            <BrandImage src={photos[index]} alt={`${title} — foto ${index + 1}`} treat={false} sizes="100vw" fit="object-contain" rounded="rounded-xl" className="h-[80vh] w-full bg-transparent" />
          ) : (
            <PhotoPlaceholder label={photos[index]} className="aspect-[4/3] w-full rounded-xl" />
          )}
        </div>
        {photos.length > 1 && (
          <IconButton onClick={next} label="Próxima foto" icon={ChevronRight} iconClassName="h-6 w-6" className="absolute right-4 z-10 h-11 w-11 bg-white/10 text-white hover:bg-white/20" />
        )}
      </div>
    </div>
  );
}
