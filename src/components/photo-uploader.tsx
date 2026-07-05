"use client";

import { useState } from "react";
import { Upload, X, Loader2, Star } from "lucide-react";
import {
  uploadPropertyPhoto,
  removePropertyPhoto,
  type UploadedPhoto,
} from "@/lib/data/storage";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface PhotoItem extends UploadedPhoto {
  id: string;
  name: string;
}

/**
 * Galeria de upload de fotos do imóvel (Supabase Storage).
 * A primeira foto é tratada como capa. Suporta múltiplos arquivos,
 * preview, remoção e estado de envio.
 *
 * `uploader`/`remover` permitem trocar o destino: por padrão, o bucket PÚBLICO
 * de fotos; para DOCUMENTOS privados (autorização de sublocação), passa-se o
 * uploader do bucket privado.
 */
export function PhotoUploader({
  photos,
  onChange,
  max = 12,
  uploader = uploadPropertyPhoto,
  remover = removePropertyPhoto,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  max?: number;
  uploader?: (file: File, ownerId?: string) => Promise<UploadedPhoto>;
  remover?: (path: string | null) => Promise<void>;
}) {
  const ownerId = useAuthStore((s) => s.user?.id);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Índice sendo arrastado (reordenar por drag — a 1ª posição é a capa).
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  /** Reordena a galeria movendo `from` para a posição `to` (a[0] = capa). */
  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const slots = max - photos.length;
    const chosen = Array.from(files).slice(0, slots);

    setUploading(true);
    try {
      const uploaded: PhotoItem[] = [];
      for (const file of chosen) {
        if (!file.type.startsWith("image/")) {
          setError("Apenas imagens são aceitas.");
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          setError("Cada foto deve ter no máximo 8 MB.");
          continue;
        }
        const result = await uploader(file, ownerId);
        uploaded.push({ ...result, id: crypto.randomUUID(), name: file.name });
      }
      onChange([...photos, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  async function remove(item: PhotoItem) {
    onChange(photos.filter((p) => p.id !== item.id));
    await remover(item.path);
  }

  function makeCover(item: PhotoItem) {
    onChange([item, ...photos.filter((p) => p.id !== item.id)]);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, i);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={cn(
              "group relative aspect-square cursor-move overflow-hidden rounded-xl border border-sage-200",
              dragIndex === i && "opacity-50 ring-2 ring-forest"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />

            {i === 0 && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-champagne px-2 py-0.5 text-xs font-semibold text-forest">
                <Star className="h-3 w-3" /> Capa
              </span>
            )}
            {p.demo && (
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                preview local
              </span>
            )}

            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(p)}
                  title="Definir como capa"
                  className="grid h-7 w-7 place-items-center rounded-full bg-white text-forest shadow"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(p)}
                title="Remover"
                className="grid h-7 w-7 place-items-center rounded-full bg-white text-red-600 shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {photos.length < max && (
          <label
            className={cn(
              "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sage-200 text-sage transition-colors hover:border-sage",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="text-xs">{uploading ? "Enviando..." : "Adicionar"}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        {photos.length}/{max} fotos · a primeira é a capa do anúncio. Arraste para reordenar. JPG
        ou PNG até 8 MB.
      </p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
