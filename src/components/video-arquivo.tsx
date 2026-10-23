"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandImage } from "@/components/brand-image";

/** Pede o endereço temporário do vídeo enviado e devolve estado para o player (só roda quando `ativo`). */
function useUrlDoVideo(imovelId: string, ativo: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    fetch(`/api/imoveis/${imovelId}/video`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sem vídeo"))))
      .then((d: { url?: string }) => {
        if (!vivo) return;
        if (d.url) setUrl(d.url);
        else setErro(true);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [imovelId, ativo]);
  return { url, erro };
}

function Tocador({ imovelId, title }: { imovelId: string; title: string }) {
  const { url, erro } = useUrlDoVideo(imovelId, true);
  if (erro) return <p className="p-6 text-center text-sm text-white" role="alert">Não foi possível carregar o vídeo agora.</p>;
  if (!url) return <Skeleton className="h-full w-full rounded-none" />;
  // Sem som por padrão, com controles; só baixa depois do clique em play (ordem 8681ae95).
  return <video src={url} controls muted autoPlay playsInline preload="metadata" aria-label={`Vídeo do imóvel ${title}`} className="h-full w-full" data-testid="video-arquivo-player" />;
}

/** Na página: miniatura com play; o vídeo só é pedido e baixado depois do clique. */
export function VideoArquivoPlayer({ imovelId, capa, title }: { imovelId: string; capa?: string; title: string }) {
  const [tocando, setTocando] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black" data-testid="video-arquivo">
      {tocando ? (
        <Tocador imovelId={imovelId} title={title} />
      ) : (
        <button type="button" onClick={() => setTocando(true)} aria-label="Tocar o vídeo do imóvel" className="group absolute inset-0 block h-full w-full" data-testid="video-arquivo-play">
          {capa && <BrandImage src={capa} alt="" rounded="rounded-none" treat={false} sizes="(max-width: 768px) 100vw, 768px" className="h-full w-full" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-forest group-hover:bg-white">
              <Play className="h-6 w-6" fill="currentColor" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/** Na galeria: o mesmo player numa janela (fecha com Esc). */
export function VideoArquivoModal({ imovelId, title, onClose }: { imovelId: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Vídeo do imóvel ${title}`} data-testid="video-modal">
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Fechar vídeo" className="absolute -top-11 right-0 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20">
          <X className="h-4 w-4" /> Fechar
        </button>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <Tocador imovelId={imovelId} title={title} />
        </div>
      </div>
    </div>
  );
}
