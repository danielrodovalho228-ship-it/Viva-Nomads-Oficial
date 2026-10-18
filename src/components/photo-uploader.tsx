"use client";

import { useState } from "react";
import { Upload, X, Loader2, Star, AlertTriangle, Undo2 } from "lucide-react";
import {
  uploadPropertyPhoto,
  removePropertyPhoto,
  type UploadedPhoto,
} from "@/lib/data/storage";
import { validarArquivoFotoImovel } from "@/lib/upload-limits";
import { useAuthStore } from "@/lib/store";
import { tratarFoto } from "@/lib/fotos/processar";
import { avisosDaFoto, MAX_FOTOS_POR_ANUNCIO, type AvisoFoto } from "@/lib/fotos/qualidade";
import { cn } from "@/lib/utils";

export interface PhotoItem extends UploadedPhoto {
  id: string;
  name: string;
  /** Hash e assinatura de aparência (detectam foto repetida) e avisos de qualidade, quando a foto foi tratada. */
  hash?: string;
  assinatura?: string;
  avisos?: AvisoFoto[];
  /** A foto passou por ajuste leve de exposição (dá para voltar ao original). */
  melhorada?: boolean;
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
  max = MAX_FOTOS_POR_ANUNCIO,
  tratar = true,
  uploader = uploadPropertyPhoto,
  remover = removePropertyPhoto,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  max?: number;
  /** Trata a foto antes de enviar (rotação EXIF, tamanho, exposição, avisos). Desligue para documentos. */
  tratar?: boolean;
  uploader?: (file: File, ownerId?: string) => Promise<UploadedPhoto>;
  remover?: (path: string | null) => Promise<void>;
}) {
  const ownerId = useAuthStore((s) => s.user?.id);
  const [uploading, setUploading] = useState(false);
  // Progresso do envio em lote ("3 de 12").
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  // Arquivos originais desta sessão, para "usar original".
  const [originais, setOriginais] = useState<Record<string, File>>({});
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
    const excedeu = files.length > slots;

    setUploading(true);
    setProgresso({ feitas: 0, total: chosen.length });
    try {
      const uploaded: PhotoItem[] = [];
      const novosOriginais: Record<string, File> = {};
      const outras: { id: string; hash?: string; assinatura?: string }[] = photos
        .filter((p) => p.hash || p.assinatura)
        .map((p) => ({ id: p.id, hash: p.hash, assinatura: p.assinatura }));
      let feitas = 0;
      for (const file of chosen) {
        // Validação de tipo/tamanho no cliente (feedback rápido). O bucket do
        // Supabase revalida no servidor (migration 0040) — o accept do input não
        // é a trava real.
        const invalido = validarArquivoFotoImovel({ type: file.type, size: file.size, name: file.name });
        if (invalido) {
          setError(invalido);
        } else {
          const t = tratar ? await tratarFoto(file) : null;
          let result: UploadedPhoto;
          try {
            result = await uploader(t?.arquivo ?? file, ownerId);
          } catch (e) {
            // Falha real de envio: erro visível, a foto NÃO entra na galeria.
            setError(e instanceof Error ? e.message : "Não foi possível enviar a foto agora.");
            feitas += 1;
            setProgresso({ feitas, total: chosen.length });
            continue;
          }
          const id = crypto.randomUUID();
          const item: PhotoItem = { ...result, id, name: file.name };
          if (t?.analise) {
            item.hash = t.analise.hash;
            item.assinatura = t.analise.assinatura;
            item.avisos = avisosDaFoto(t.analise, outras);
            item.melhorada = t.melhorada;
            outras.push({ id, hash: t.analise.hash, assinatura: t.analise.assinatura });
          }
          if (t?.melhorada) novosOriginais[id] = t.original;
          uploaded.push(item);
        }
        feitas += 1;
        setProgresso({ feitas, total: chosen.length });
      }
      onChange([...photos, ...uploaded]);
      setOriginais((o) => ({ ...o, ...novosOriginais }));
      if (excedeu) setError(`Limite de ${max} fotos: as que passaram disso não foram enviadas.`);
    } finally {
      setUploading(false);
      setProgresso(null);
    }
  }

  /** Troca a foto melhorada pelo original escolhido (sem ajuste de exposição). */
  async function usarOriginal(item: PhotoItem) {
    const original = originais[item.id];
    if (!original) return;
    setError(null);
    try {
      // Passa pelo canvas (sem ajuste de exposição) para descartar EXIF/GPS.
      const t = await tratarFoto(original, { semExposicao: true });
      const result = await uploader(t.arquivo, ownerId);
      onChange(photos.map((p) => (p.id === item.id ? { ...p, ...result, melhorada: false } : p)));
      setOriginais((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== item.id)));
      await remover(item.path);
    } catch {
      setError("Não foi possível voltar ao original agora. Tente de novo.");
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
          <div key={p.id} className={cn(i === 0 && "col-span-2")}>
          <div
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
              "group relative aspect-[4/3] cursor-move overflow-hidden rounded-xl border border-sage-200",
              dragIndex === i && "opacity-50 ring-2 ring-forest"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />

            {/* Q6: o aviso de repetida fica DENTRO do card da foto repetida, com a miniatura da parecida. */}
            {p.avisos
              ?.filter((a) => a.codigo === "repetida")
              .map((a) => {
                const parecida = photos.find((x) => x.id === a.parecidaCom);
                return (
                  <div
                    key="repetida"
                    className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1.5 rounded-lg bg-amber-50/95 p-1.5 text-[11px] leading-tight text-amber-900 shadow"
                    data-testid="aviso-foto-repetida"
                  >
                    {parecida && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={parecida.url} alt="Foto parecida" className="h-8 w-10 shrink-0 rounded object-cover" data-testid="aviso-foto-repetida-miniatura" />
                    )}
                    <span>
                      <strong>{a.mensagem}</strong> {parecida ? "Quase igual a esta foto." : a.dica}
                    </span>
                  </div>
                );
              })}

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

            <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
          {(p.avisos?.some((a) => a.codigo !== "repetida") || p.melhorada) ? (
            <div className="mt-1 space-y-1 text-xs">
              {p.avisos?.filter((a) => a.codigo !== "repetida").map((a) => (
                <p key={a.codigo} className="flex items-start gap-1 text-amber-800" data-testid={`aviso-foto-${a.codigo}`}>
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span><strong>{a.mensagem}</strong> {a.dica}</span>
                </p>
              ))}
              {p.melhorada && !!originais[p.id] && (
                <button
                  type="button"
                  onClick={() => usarOriginal(p)}
                  className="inline-flex items-center gap-1 font-medium text-forest underline"
                >
                  <Undo2 className="h-3 w-3" /> Clareamos um pouco esta foto. Usar original
                </button>
              )}
            </div>
          ) : null}
          </div>
        ))}

        {photos.length < max && (
          <label
            className={cn(
              "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sage-200 text-sage transition-colors hover:border-sage",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="text-xs">{uploading ? (progresso ? `Enviando ${Math.min(progresso.feitas + 1, progresso.total)} de ${progresso.total}…` : "Enviando...") : "Adicionar"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        {photos.length}/{max} fotos · a primeira é a capa do anúncio (corte 4:3). Pode escolher
        várias de uma vez, na vertical ou na horizontal. Arraste para reordenar. JPG, PNG ou WebP até 8 MB.
      </p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
