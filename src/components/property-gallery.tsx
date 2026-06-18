"use client";

import { useState } from "react";
import { X, Images, ChevronLeft, ChevronRight } from "lucide-react";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const isPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/**
 * Galeria adaptável (rodada 11) — sem altura fixa nem vão vazio.
 * - Mobile: carrossel horizontal de largura total com contador.
 * - Desktop: mosaico (1 foto grande + grade) que se ajusta à quantidade.
 * - "Ver todas" abre um lightbox com todas as fotos.
 */
export function PropertyGallery({
  photos,
  title,
  readyToLive,
}: {
  photos: string[];
  title: string;
  readyToLive?: boolean;
}) {
  const [lightbox, setLightbox] = useState(false);
  const [index, setIndex] = useState(0);
  const list = photos.length ? photos : [""];

  function openAt(i: number) {
    setIndex(i);
    setLightbox(true);
  }

  return (
    <>
      {/* ── Mobile: carrossel ── */}
      <MobileCarousel photos={list} title={title} readyToLive={readyToLive} onOpen={openAt} />

      {/* ── Desktop: mosaico adaptável ── */}
      <DesktopMosaic
        photos={list}
        title={title}
        readyToLive={readyToLive}
        onOpen={openAt}
        onSeeAll={() => openAt(0)}
      />

      {lightbox && (
        <Lightbox
          photos={list}
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
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
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
}: {
  photos: string[];
  title: string;
  readyToLive?: boolean;
  onOpen: (i: number) => void;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="relative md:hidden">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((p, i) => (
          <div key={i} className="aspect-[4/3] w-full shrink-0 snap-center">
            <Tile src={p} alt={`${title} — foto ${i + 1}`} className="h-full w-full" onClick={() => onOpen(i)} />
          </div>
        ))}
      </div>
      {readyToLive && (
        <div className="absolute left-3 top-3">
          <ReadyToLiveBadge size="sm" />
        </div>
      )}
      <span className="absolute bottom-3 right-3 rounded-full bg-night/70 px-2.5 py-1 text-xs font-medium text-white">
        {active + 1}/{photos.length}
      </span>
      {/* Pontos */}
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-4 bg-forest" : "w-1.5 bg-sage-200"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DesktopMosaic({
  photos,
  title,
  readyToLive,
  onOpen,
  onSeeAll,
}: {
  photos: string[];
  title: string;
  readyToLive?: boolean;
  onOpen: (i: number) => void;
  onSeeAll: () => void;
}) {
  const n = photos.length;

  // 1 foto: ocupa tudo. 2–4: principal + coluna. 5+: mosaico clássico.
  let content: React.ReactNode;
  if (n === 1) {
    content = (
      <div className="aspect-[16/9] overflow-hidden rounded-2xl">
        <Tile src={photos[0]} alt={title} className="h-full w-full" onClick={() => onOpen(0)} />
      </div>
    );
  } else if (n < 5) {
    content = (
      <div className="grid aspect-[2/1] grid-cols-3 gap-2 overflow-hidden rounded-2xl">
        <Tile src={photos[0]} alt={title} className="col-span-2 row-span-1 h-full" onClick={() => onOpen(0)} />
        <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${n - 1}, minmax(0, 1fr))` }}>
          {photos.slice(1).map((p, i) => (
            <Tile key={i} src={p} alt={`${title} — ${i + 2}`} className="h-full" onClick={() => onOpen(i + 1)} />
          ))}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="grid aspect-[2/1] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
        <Tile src={photos[0]} alt={title} className="col-span-2 row-span-2 h-full" onClick={() => onOpen(0)} />
        {photos.slice(1, 5).map((p, i) => {
          const isLast = i === 3 && n > 5;
          return (
            <div key={i} className="relative h-full">
              <Tile src={p} alt={`${title} — ${i + 2}`} className="h-full w-full" onClick={() => onOpen(i + 1)} />
              {isLast && (
                <button
                  type="button"
                  onClick={onSeeAll}
                  className="absolute inset-0 grid place-items-center bg-night/55 text-sm font-semibold text-white"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Images className="h-4 w-4" /> +{n - 5} fotos
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative hidden md:block">
      {content}
      {readyToLive && (
        <div className="absolute left-4 top-4">
          <ReadyToLiveBadge />
        </div>
      )}
      <button
        type="button"
        onClick={onSeeAll}
        className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-white"
      >
        <Images className="h-4 w-4" /> Ver todas ({n})
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
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night/95">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm">
          {index + 1} / {photos.length}
        </span>
        <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
        {photos.length > 1 && (
          <button onClick={prev} aria-label="Anterior" className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className="max-h-full w-full max-w-4xl">
          {isPhoto(photos[index]) ? (
            <BrandImage src={photos[index]} alt={`${title} — foto ${index + 1}`} treat={false} sizes="100vw" className="max-h-[80vh] w-full rounded-xl object-contain" />
          ) : (
            <PhotoPlaceholder label={photos[index]} className="aspect-[4/3] w-full rounded-xl" />
          )}
        </div>
        {photos.length > 1 && (
          <button onClick={next} aria-label="Próxima" className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
