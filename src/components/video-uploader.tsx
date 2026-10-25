"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Loader2, RotateCcw, Trash2, Video } from "lucide-react";
import { enviarVideoAnuncio, ErroEnvioVideo, removerVideoAnuncio, VIDEO_ACCEPT } from "@/lib/data/storage-video";
import { erroDoLinkDeVideo, formatarDuracao, GUIA_VIDEO_HREF, segundosDoCaminho, TEXTO_LIMITES_VIDEO } from "@/lib/video-anuncio";
import { useAuthStore } from "@/lib/store";

/**
 * Vídeo do anúncio (ordem 8681ae95; 65-B): 1 por anúncio, até 60 s e 50 MB, MP4/MOV. Funciona pelo celular (abre a
 * câmera ou a galeria) e pelo computador. Opcional: nunca bloqueia publicar.
 * Duas partes: "Enviar um vídeo curto" e, com `onVideoUrlChange`, "Ou colar um link do YouTube ou Vimeo". Com arquivo
 * enviado, a página mostra o arquivo; o link só aparece sem arquivo (videoDoAnuncio).
 * Usado no editor por seções (seção Vídeo) e no passo Fotos do assistente (bloco próprio, antes da caixa da IA).
 */
export function VideoUploader({
  path,
  onChange,
  videoUrl,
  onVideoUrlChange,
}: {
  path: string;
  onChange: (path: string) => void;
  videoUrl?: string;
  onVideoUrlChange?: (url: string) => void;
}) {
  const ownerId = useAuthStore((s) => s.user?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  // `arquivo`: queda de rede — o mesmo arquivo pode ir de novo pelo "Tentar de novo".
  const [erro, setErro] = useState<{ texto: string; arquivo: File | null } | null>(null);
  const segundos = segundosDoCaminho(path);
  const erroLink = erroDoLinkDeVideo(videoUrl ?? "");

  async function escolher(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setEnviando(true);
    try {
      const novo = await enviarVideoAnuncio(file, ownerId);
      const antigo = path;
      onChange(novo);
      if (antigo) await removerVideoAnuncio(antigo); // troca: o anterior sai do bucket
    } catch (e) {
      const tentarDeNovo = e instanceof ErroEnvioVideo && e.tentarDeNovo;
      setErro({ texto: e instanceof Error ? e.message : "Não foi possível enviar o vídeo agora.", arquivo: tentarDeNovo ? file : null });
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
    <div className="space-y-4" data-testid="video-uploader">
      <div className="rounded-xl border border-sage-200 p-4">
        <p className="text-sm font-semibold text-ink">Enviar um vídeo curto</p>
        <p className="mt-1 text-xs text-muted" data-testid="video-limites">{TEXTO_LIMITES_VIDEO}</p>
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
              <span className="text-sm text-forest" data-testid="video-enviado">
                Vídeo enviado{segundos != null ? ` (${formatarDuracao(segundos)})` : ""}
              </span>
              <button type="button" onClick={() => void remover()} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-red-600 underline" data-testid="video-remover">
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            </>
          )}
        </div>
        {erro && (
          <div className="mt-2">
            <p role="alert" className="text-sm text-red-600" data-testid="video-erro">
              {erro.texto}
            </p>
            {erro.arquivo && !enviando && (
              <button
                type="button"
                onClick={() => void escolher(erro.arquivo ?? undefined)}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-forest px-3 text-sm font-semibold text-forest"
                data-testid="video-tentar-de-novo"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Tentar de novo
              </button>
            )}
          </div>
        )}
      </div>

      {onVideoUrlChange && (
        <div className="rounded-xl border border-sage-200 p-4">
          <label className="block text-sm font-semibold text-ink" htmlFor="video-link">
            Ou colar um link do YouTube ou Vimeo
          </label>
          <input
            id="video-link"
            className="input mt-2"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={videoUrl ?? ""}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            aria-invalid={!!erroLink}
            data-testid="video-link"
          />
          {erroLink ? (
            <p className="mt-2 text-sm text-red-600" data-testid="video-link-erro">{erroLink}</p>
          ) : (
            path && videoUrl?.trim() && <p className="mt-2 text-xs text-muted">Com um vídeo enviado, o anúncio mostra o vídeo enviado. O link fica guardado.</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted">
        Dúvidas?{" "}
        <Link href={GUIA_VIDEO_HREF} target="_blank" className="font-medium text-forest underline" data-testid="video-ajuda">
          Como pôr um vídeo no anúncio
        </Link>
      </p>
    </div>
  );
}
