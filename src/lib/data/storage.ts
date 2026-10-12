"use client";

import { createClient } from "@/lib/supabase/client";
import { stripImageExif } from "@/lib/image/strip-exif";

export const PROPERTY_PHOTOS_BUCKET = "property-photos";

export interface UploadedPhoto {
  url: string;
  path: string | null; // caminho no Storage (null em modo demo)
  demo: boolean;
}

/**
 * Envia uma foto de imóvel pelo SERVIDOR (/api/upload/foto), que confere o tipo
 * REAL do arquivo (JPEG/PNG/WebP — nunca SVG/executável/texto) e exige dono
 * logado. Sem Supabase configurado, gera um preview local (modo demonstração).
 * Em modo real, qualquer falha LANÇA erro com a mensagem — nunca vira preview
 * local contando como foto.
 */
export async function uploadPropertyPhoto(file: File, ownerId?: string): Promise<UploadedPhoto> {
  const supabase = createClient();

  // Remove o EXIF (inclusive GPS/endereço) ANTES de qualquer coisa — vale também
  // para o preview local do modo demo, para nunca expor a geolocalização.
  const safe = await stripImageExif(file);

  if (!supabase) {
    return { url: URL.createObjectURL(safe), path: null, demo: true };
  }
  if (!ownerId) throw new Error("Entre na sua conta para enviar fotos.");

  const fd = new FormData();
  fd.append("file", safe);
  const res = await fetch("/api/upload/foto", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { path?: string; url?: string; error?: string };
  if (!res.ok || !data.path || !data.url) throw new Error(data.error ?? "Não foi possível enviar a foto agora.");
  return { url: data.url, path: data.path, demo: false };
}

/** Remove uma foto do Storage (quando não é preview local). */
export async function removePropertyPhoto(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  if (!supabase) return;
  await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([path]);
}

/** Bucket privado dos documentos. */
export const PROPERTY_DOCS_BUCKET = "property-docs";

/**
 * Envia um DOCUMENTO privado (autorização de sublocação, contrato de
 * administração, procuração) pelo SERVIDOR (/api/upload/documento): confere o
 * tipo REAL do arquivo, o tamanho e grava na pasta do próprio dono no bucket
 * PRIVADO. Devolve o `path` (guardado no imóvel) e uma URL assinada curta só
 * para o preview. Sem Supabase → preview local (demo, não conta como anexado).
 * Recusa do servidor (tipo/tamanho/limite) → erro com a mensagem, para o
 * uploader mostrar.
 */
export async function uploadPropertyDoc(file: File): Promise<UploadedPhoto> {
  const supabase = createClient();
  if (!supabase) return { url: URL.createObjectURL(file), path: null, demo: true };

  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/documento", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { path?: string | null; error?: string };
  if (!res.ok || !data.path) throw new Error(data.error ?? "Não foi possível enviar o documento agora.");

  // Bucket privado: URL assinada de 10 min só para a pré-visualização no formulário.
  const { data: signed } = await supabase.storage.from(PROPERTY_DOCS_BUCKET).createSignedUrl(data.path, 600);
  return { url: signed?.signedUrl ?? "", path: data.path, demo: false };
}

/** Remove um documento do bucket privado. */
export async function removePropertyDoc(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  if (!supabase) return;
  await supabase.storage.from(PROPERTY_DOCS_BUCKET).remove([path]);
}
