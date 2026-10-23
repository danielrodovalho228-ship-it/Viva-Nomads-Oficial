"use client";

import { createClient } from "@/lib/supabase/client";
import { caminhoNovoVideo, validarVideoNoNavegador, VIDEO_MIME, type VideoMime } from "@/lib/video-anuncio";

export const VIDEO_ANUNCIO_BUCKET = "anuncio-videos";

/**
 * Envia o vídeo do anúncio direto ao bucket privado (50 MB não cabem numa função da Vercel) e pede ao servidor a
 * conferência de verdade (tipo real, tamanho, duração até 60 s); se o servidor recusar, ele mesmo apaga o arquivo.
 * Devolve o caminho "<uid>/<arquivo>" ou LANÇA o erro em português para a tela mostrar.
 */
export async function enviarVideoAnuncio(file: File, ownerId?: string): Promise<string> {
  const erro = validarVideoNoNavegador(file);
  if (erro) throw new Error(erro);
  const supabase = createClient();
  if (!supabase) throw new Error("Envio de vídeo indisponível no modo demonstração.");
  if (!ownerId) throw new Error("Entre na sua conta para enviar vídeo.");

  const path = caminhoNovoVideo(ownerId, file.type as VideoMime);
  const { error } = await supabase.storage.from(VIDEO_ANUNCIO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Não foi possível enviar o vídeo agora. Tente de novo.");

  const res = await fetch("/api/upload/video/confirmar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Não foi possível conferir o vídeo agora. Tente de novo.");
  return path;
}

/** Apaga o vídeo do bucket (política: só o dono, na própria pasta). */
export async function removerVideoAnuncio(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  if (!supabase) return;
  await supabase.storage.from(VIDEO_ANUNCIO_BUCKET).remove([path]);
}

export const VIDEO_ACCEPT = VIDEO_MIME.join(",");
