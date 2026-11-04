"use client";

import { useRef } from "react";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACEITA_ANEXO, tamanhoLegivel, urlDoAnexo, type AnexoNaBolha } from "@/lib/messages/anexo-tela";

/*
  E445 item 5 (tela, Pista A): anexar foto ou PDF na conversa. O backend (Pista B, 0288) confere o tipo real pelos bytes,
  guarda no bucket privado e só entrega por URL assinada às duas partes. A tela:
   - regrava a FOTO em WebP no navegador antes de enviar (o EXIF — inclusive a localização — não vai junto);
   - mostra a prévia antes de enviar (foto ou o PDF com nome e tamanho) com "Enviar anexo" e "Cancelar";
   - mostra o anexo na bolha (foto em miniatura; PDF como cartão "Abrir PDF"), sempre pela rota do servidor.
*/

const LADO_MAX = 2560;

/** Foto sem dados de localização: redesenha no canvas (o EXIF não passa) e grava em WebP. PDF segue como está. */
export async function semLocalizacao(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("webp");
  return new File([blob], "foto.webp", { type: "image/webp" });
}

/** O clipe ao lado do campo: abre o seletor (só foto e PDF). */
export function BotaoAnexar({ onEscolher, desligado }: { onEscolher: (f: File) => void; desligado?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={desligado}
        aria-label="Anexar foto ou PDF"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sage-200 bg-white text-ink hover:border-forest disabled:opacity-50"
        data-testid="anexo-botao"
      >
        <Paperclip className="h-4 w-4" aria-hidden />
      </button>
      <input
        ref={entrada}
        type="file"
        accept={ACEITA_ANEXO}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="anexo-entrada"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onEscolher(f);
        }}
      />
    </>
  );
}

/** Prévia antes de enviar. Os dois botões são de contorno: o único botão cheio da tela é o Enviar. */
export function PreviaAnexo(p: {
  arquivo: File;
  previaUrl: string | null;
  enviando: boolean;
  onEnviar: () => void;
  onCancelar: () => void;
}) {
  const pdf = p.arquivo.type === "application/pdf";
  return (
    <div className="border-t border-sage-200 bg-white px-4 py-3" data-testid="anexo-previa">
      <div className="flex items-center gap-3">
        {pdf || !p.previaUrl ? (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-2 text-forest" aria-hidden>
            <FileText className="h-6 w-6" />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), não passa pelo otimizador
          <img src={p.previaUrl} alt="Prévia da foto" className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover" data-testid="anexo-previa-foto" />
        )}
        <span className="min-w-0 flex-1 text-sm text-ink">
          <span className="block font-semibold">{pdf ? "PDF" : "Foto"}</span>
          <span className="block text-xs text-muted">
            {pdf ? `${tamanhoLegivel(p.arquivo.size)} · ` : ""}
            {pdf ? "o nome do arquivo não é enviado" : "sem dados de localização"}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={p.onCancelar}
          disabled={p.enviando}
          className="min-h-11 rounded-full border border-sage-200 bg-white px-4 text-sm font-semibold text-ink hover:border-forest disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={p.onEnviar}
          disabled={p.enviando}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest bg-white px-4 text-sm font-semibold text-forest hover:bg-sage-100 disabled:opacity-60"
          data-testid="anexo-enviar"
        >
          {p.enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {p.enviando ? "Enviando…" : "Enviar anexo"}
        </button>
      </div>
    </div>
  );
}

/** O anexo dentro da bolha. */
export function AnexoNaMensagem({ anexo, minha }: { anexo: AnexoNaBolha; minha: boolean }) {
  const url = urlDoAnexo(anexo.id);
  if (anexo.tipo === "foto")
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block" data-testid="anexo-foto" aria-label="Abrir a foto">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada privada (redirecionamento), fora do otimizador */}
        <img src={url} alt="Foto enviada na conversa" loading="lazy" className="max-h-60 w-full max-w-64 rounded-lg bg-surface-2 object-cover" />
      </a>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", minha ? "bg-white/15 text-white" : "bg-sage-100 text-forest")}
      data-testid="anexo-pdf"
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden />
      Abrir PDF
    </a>
  );
}
