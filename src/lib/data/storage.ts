"use client";

import { createClient } from "@/lib/supabase/client";

export const PROPERTY_PHOTOS_BUCKET = "property-photos";

export interface UploadedPhoto {
  url: string;
  path: string | null; // caminho no Storage (null em modo demo)
  demo: boolean;
}

/**
 * Envia uma foto de imóvel para o Supabase Storage e devolve a URL pública.
 * Sem Supabase configurado, gera um preview local (modo demonstração).
 */
export async function uploadPropertyPhoto(
  file: File,
  ownerId?: string
): Promise<UploadedPhoto> {
  const supabase = createClient();

  if (!supabase) {
    return { url: URL.createObjectURL(file), path: null, demo: true };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const folder = ownerId ?? "anon";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    // Falha de upload: cai para preview local para não travar o fluxo.
    return { url: URL.createObjectURL(file), path: null, demo: true };
  }

  const { data } = supabase.storage.from(PROPERTY_PHOTOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, demo: false };
}

/** Remove uma foto do Storage (quando não é preview local). */
export async function removePropertyPhoto(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  if (!supabase) return;
  await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([path]);
}
