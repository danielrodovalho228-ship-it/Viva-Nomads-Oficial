"use client";

import { createClient } from "@/lib/supabase/client";
import { caminhoNovoVideo, validarVideoNoNavegador, validarVideoNoServidor, VIDEO_MIME } from "@/lib/video-anuncio";

export const VIDEO_ANUNCIO_BUCKET = "anuncio-videos";

/** Erro do envio com o texto para a tela; `tentarDeNovo` = falha de rede (o mesmo arquivo pode ir de novo). */
export class ErroEnvioVideo extends Error {
  constructor(mensagem: string, readonly tentarDeNovo = false) {
    super(mensagem);
  }
}

const MSG_REDE = "A conexão caiu durante o envio. Nada foi gravado.";

/**
 * Envia o vídeo do anúncio direto ao bucket privado (50 MB não cabem numa função da Vercel) e pede ao servidor a
 * conferência de verdade (tipo real, tamanho, duração até 60 s); se o servidor recusar, ele mesmo apaga o arquivo.
 * 65-B: antes de enviar, o navegador já lê o próprio arquivo com a MESMA regra do servidor (formato real, tamanho,
 * duração), então o erro aparece na hora; a duração vai no nome do arquivo. Queda de rede no meio apaga o que subiu.
 * Devolve o caminho "<uid>/<arquivo>" ou LANÇA ErroEnvioVideo em português para a tela mostrar.
 */
export async function enviarVideoAnuncio(file: File, ownerId?: string): Promise<string> {
  const erro = validarVideoNoNavegador(file);
  if (erro) throw new ErroEnvioVideo(erro);
  const conferido = validarVideoNoServidor(new Uint8Array(await file.arrayBuffer()), file.size);
  if (!conferido.ok) throw new ErroEnvioVideo(conferido.erro);
  const supabase = createClient();
  if (!supabase) throw new ErroEnvioVideo("Envio de vídeo indisponível no modo demonstração.");
  if (!ownerId) throw new ErroEnvioVideo("Entre na sua conta para enviar vídeo.");

  const path = caminhoNovoVideo(ownerId, conferido.tipo, undefined, conferido.segundos);
  let subiu;
  try {
    subiu = await supabase.storage.from(VIDEO_ANUNCIO_BUCKET).upload(path, file, { contentType: conferido.tipo, upsert: false });
  } catch {
    throw new ErroEnvioVideo(MSG_REDE, true);
  }
  // O envio simples grava o arquivo inteiro ou nada: erro aqui não deixa meio arquivo. Sem resposta do servidor
  // (StorageUnknownError: a requisição nem chegou) é queda de rede.
  if (subiu.error) {
    const semResposta = (subiu.error as { name?: string }).name === "StorageUnknownError";
    throw new ErroEnvioVideo(semResposta ? MSG_REDE : "Não foi possível enviar o vídeo agora.", true);
  }

  let res: Response;
  try {
    res = await fetch("/api/upload/video/confirmar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    });
  } catch {
    // Subiu mas não deu para conferir: não fica arquivo solto sem dono no anúncio.
    await removerVideoAnuncio(path).catch(() => {});
    throw new ErroEnvioVideo(MSG_REDE, true);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status >= 500) await removerVideoAnuncio(path).catch(() => {});
    throw new ErroEnvioVideo(data.error ?? "Não foi possível conferir o vídeo agora.", res.status >= 500);
  }
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
