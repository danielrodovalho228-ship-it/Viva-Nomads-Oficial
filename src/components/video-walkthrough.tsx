"use client";

import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { resolverVideoTour } from "@/lib/video-tour";

/** Janela do vídeo (só provedores permitidos; sem autoplay com som). */
export function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const src = resolverVideoTour(url);

  // Fecha com Esc e bloqueia o scroll do fundo enquanto o modal está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Vídeo do imóvel ${title}`}
      data-testid="video-modal"
    >
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar vídeo"
          className="absolute -top-11 right-0 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          <X className="h-4 w-4" /> Fechar
        </button>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            src={src}
            title={`Vídeo do imóvel ${title}`}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

export function VideoWalkthrough({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  if (!resolverVideoTour(url)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
        <PlayCircle className="h-4 w-4" /> Ver vídeo do imóvel
      </button>
      {open && <VideoModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
