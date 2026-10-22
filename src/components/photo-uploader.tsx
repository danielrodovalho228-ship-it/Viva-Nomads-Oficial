"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, Star, AlertTriangle, Undo2 } from "lucide-react";
import {
  uploadPropertyPhoto,
  removePropertyPhoto,
  type UploadedPhoto,
} from "@/lib/data/storage";
import { useAuthStore } from "@/lib/store";
import { tratarFoto } from "@/lib/fotos/processar";
import { enviarFotos } from "@/lib/fotos/enviar";
import { MAX_FOTOS_POR_ANUNCIO, type AvisoFoto } from "@/lib/fotos/qualidade";
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
  // Prompt 22 (item 8): "Adicionar" é um BOTÃO que abre a escolha de arquivos, e a galeria aceita ARRASTAR E SOLTAR
  // arquivos do computador (antes o soltar só reordenava as fotos, apesar do texto "arraste e solte").
  const inputRef = useRef<HTMLInputElement>(null);
  const [soltando, setSoltando] = useState(false);
  const temArquivos = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

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
    setUploading(true);
    try {
      // Um caminho só para enviar fotos (prompt 20): o mesmo do cartão "Preencher com IA" e da barra do celular.
      const r = await enviarFotos(Array.from(files), {
        atuais: photos,
        max,
        ownerId,
        tratar,
        uploader,
        aoProgresso: (feitas, total) => setProgresso({ feitas, total }),
      });
      onChange([...photos, ...r.novas]);
      setOriginais((o) => ({ ...o, ...r.originais }));
      if (r.erro) setError(r.erro);
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
      <div
        className={cn("grid grid-cols-2 gap-3 rounded-xl sm:grid-cols-3", soltando && "ring-2 ring-forest ring-offset-2")}
        data-testid="fotos-galeria"
        onDragOver={(e) => {
          if (!temArquivos(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setSoltando(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false);
        }}
        onDrop={(e) => {
          setSoltando(false);
          if (!e.dataTransfer?.files?.length) return; // arrastar uma foto da galeria: só reordena (tratado no item)
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
      >
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
                    className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-2 rounded-lg bg-amber-50/95 p-2 text-[11px] leading-tight text-amber-900 "
                    data-testid="aviso-foto-repetida"
                  >
                    {parecida && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={parecida.url} alt="Foto parecida" className="h-8 w-10 shrink-0 rounded-lg object-cover" data-testid="aviso-foto-repetida-miniatura" />
                    )}
                    <span>
                      <strong>{a.mensagem}</strong> {parecida ? "Quase igual a esta foto." : a.dica}
                    </span>
                  </div>
                );
              })}

            {i === 0 && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-champagne px-2 py-1 text-xs font-semibold text-forest">
                <Star className="h-3 w-3" /> Capa
              </span>
            )}
            {p.demo && (
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                preview local
              </span>
            )}

            <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(p)}
                  title="Definir como capa"
                  className="grid h-7 w-7 place-items-center rounded-full bg-white text-forest "
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(p)}
                title="Remover"
                className="grid h-7 w-7 place-items-center rounded-full bg-white text-red-600 "
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {(p.avisos?.some((a) => a.codigo !== "repetida") || p.melhorada) ? (
            <div className="mt-1 space-y-1 text-xs">
              {p.avisos?.filter((a) => a.codigo !== "repetida").map((a) => (
                <p key={a.codigo} className="flex items-start gap-1 text-amber-800" data-testid={`aviso-foto-${a.codigo}`}>
                  <AlertTriangle className="mt-1 h-3 w-3 shrink-0" />
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sage-200 text-sage transition-colors hover:border-sage focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest",
              uploading && "pointer-events-none opacity-60"
            )}
            data-testid="fotos-adicionar"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="text-xs">{uploading ? (progresso ? `Enviando ${Math.min(progresso.feitas + 1, progresso.total)} de ${progresso.total}…` : "Enviando...") : "Adicionar"}</span>
            <span className="hidden text-[11px] text-muted sm:block">ou arraste as fotos para cá</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          data-testid="fotos-input"
          onChange={(e) => {
            const files = e.target.files;
            void handleFiles(files).finally(() => {
              // Escolher o MESMO arquivo de novo também dispara (antes ficava sem resposta).
              if (inputRef.current) inputRef.current.value = "";
            });
          }}
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        {photos.length}/{max} fotos · a primeira é a capa do anúncio (corte 4:3). Pode escolher
        várias de uma vez, na vertical ou na horizontal. Arraste para reordenar. JPG, PNG ou WebP até 8 MB.
      </p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
