"use client";

import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";

/**
 * Converte uma URL de vídeo (YouTube, Vimeo ou arquivo direto) para o formato
 * adequado de reprodução. Retorna o tipo "embed" (iframe) ou "file" (<video>).
 */
function resolveVideo(url: string): { kind: "embed"; src: string } | { kind: "file"; src: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube: youtu.be/<id> ou youtube.com/watch?v=<id>
    if (host === "youtu.be") {
      return { kind: "embed", src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
    }
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return { kind: "embed", src: `https://www.youtube.com/embed/${id}` };
    }
    // Vimeo: vimeo.com/<id>
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return { kind: "embed", src: `https://player.vimeo.com/video/${id}` };
    }
  } catch {
    // URL inválida → trata como arquivo
  }
  return { kind: "file", src: url };
}

export function VideoWalkthrough({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const video = resolveVideo(url);

  // Fecha com Esc e bloqueia o scroll do fundo enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-night px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-night/90"
      >
        <PlayCircle className="h-4 w-4" /> Ver vídeo do imóvel
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Vídeo do imóvel ${title}`}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar vídeo"
              className="absolute -top-11 right-0 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" /> Fechar
            </button>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
              {video.kind === "embed" ? (
                <iframe
                  src={video.src}
                  title={`Vídeo do imóvel ${title}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={video.src} controls autoPlay className="h-full w-full">
                  Seu navegador não suporta a reprodução de vídeo.
                </video>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
