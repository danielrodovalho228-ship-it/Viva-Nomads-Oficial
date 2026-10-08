"use client";

import { useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { uploadPropertyDoc, removePropertyDoc } from "@/lib/data/storage";
import { validarArquivoDoc } from "@/lib/upload-limits";
import type { PhotoItem } from "@/components/photo-uploader";

/**
 * Envio de UM documento privado (PDF, JPG ou PNG) — autorização de sublocação,
 * contrato de administração ou procuração. Passa pelo servidor, que confere o
 * tipo real do arquivo e grava na pasta do dono no bucket privado. Mostra só o
 * nome do arquivo (o documento não é exibido como foto).
 */
export function DocumentoUploader({
  docs,
  onChange,
  rotulo = "Enviar documento",
}: {
  docs: PhotoItem[];
  onChange: (docs: PhotoItem[]) => void;
  rotulo?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atual = docs[0];

  async function enviar(file: File | undefined) {
    if (!file) return;
    setErro(null);
    const invalido = validarArquivoDoc({ type: file.type, size: file.size });
    if (invalido) return setErro(invalido);
    setEnviando(true);
    try {
      const r = await uploadPropertyDoc(file);
      if (atual?.path) await removePropertyDoc(atual.path).catch(() => {});
      onChange([{ ...r, id: crypto.randomUUID(), name: file.name }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o documento agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (!atual) return;
    onChange([]);
    await removePropertyDoc(atual.path).catch(() => {});
  }

  return (
    <div>
      {atual ? (
        <div className="flex items-center gap-2 rounded-lg border border-sage-200 bg-surface-2 px-3 py-2 text-sm" data-testid="documento-anexado">
          <FileText className="h-4 w-4 shrink-0 text-forest" />
          <span className="min-w-0 flex-1 truncate text-ink">{atual.name}</span>
          {atual.demo && <span className="text-xs text-amber-700">só pré-visualização</span>}
          <button type="button" onClick={remover} className="rounded p-1 text-muted hover:text-red-600" aria-label="Remover documento">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-sage-200 px-3 py-4 text-sm font-medium text-forest hover:border-sage">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {enviando ? "Enviando…" : rotulo}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only"
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void enviar(f);
            }}
          />
        </label>
      )}
      {erro && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
