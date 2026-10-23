"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Video } from "lucide-react";
import { enviarVideoAnuncio, removerVideoAnuncio, VIDEO_ACCEPT } from "@/lib/data/storage-video";
import { VIDEO_MAX_SEGUNDOS } from "@/lib/video-anuncio";
import { useAuthStore } from "@/lib/store";

/**
 * Vídeo curto do anúncio (ordem 8681ae95): 1 por anúncio, até 60 s e 50 MB, MP4/MOV. Funciona pelo celular
 * (abre a câmera ou a galeria) e pelo computador. Opcional: nunca bloqueia publicar.
 */
export function VideoUploader({ path, onChange }: { path: string; onChange: (path: string) => void }) {
  const ownerId = useAuthStore((s) => s.user?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setEnviando(true);
    try {
      const novo = await enviarVideoAnuncio(file, ownerId);
      if (path) await removerVideoAnuncio(path); // troca: o anterior sai do bucket
      onChange(novo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o vídeo agora.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    const antigo = path;
    onChange("");
    await removerVideoAnuncio(antigo);
  }

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="video-uploader">
      <p className="text-sm font-semibold text-ink">Vídeo curto do imóvel (opcional)</p>
      <p className="mt-1 text-xs text-muted">Até {VIDEO_MAX_SEGUNDOS} segundos e 50 MB, em MP4 ou MOV. Grave pelo celular e mostre o imóvel por dentro.</p>
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="sr-only"
        data-testid="video-input"
        aria-label="Escolher vídeo do imóvel"
        onChange={(e) => void escolher(e.target.files?.[0])}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest px-4 text-sm font-medium text-forest disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          {enviando ? "Enviando…" : path ? "Trocar vídeo" : "Enviar vídeo"}
        </button>
        {path && !enviando && (
          <>
            <span className="text-sm text-forest" data-testid="video-enviado">Vídeo enviado</span>
            <button type="button" onClick={() => void remover()} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-red-600 underline">
              <Trash2 className="h-4 w-4" /> Remover
            </button>
          </>
        )}
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600" data-testid="video-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
