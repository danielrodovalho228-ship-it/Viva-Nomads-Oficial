"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Janela da própria tela para pedir o MOTIVO de uma ação de moderação (recusar
 * checklist, ocultar pedido…). Substitui o `window.prompt` do navegador: motivo
 * obrigatório, limite de tamanho, Esc fecha, erro do servidor aparece aqui.
 */
export function MotivoDialog({
  open,
  titulo,
  descricao,
  confirmar,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  titulo: string;
  descricao?: string;
  confirmar: string;
  onCancel: () => void;
  /** Devolve uma mensagem de erro para manter a janela aberta, ou null. */
  onConfirm: (motivo: string) => Promise<string | null>;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const m = motivo.trim();
    if (!m) {
      setErro("Escreva o motivo.");
      return;
    }
    setEnviando(true);
    const falha = await onConfirm(m);
    setEnviando(false);
    if (falha) setErro(falha);
    else {
      setMotivo("");
      setErro(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-night/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="motivo-titulo"
    >
      <form onSubmit={enviar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="motivo-titulo" className="font-title text-lg font-bold text-ink">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {descricao && <p className="mt-1 text-sm text-muted">{descricao}</p>}
        <label className="mt-4 block text-sm font-medium text-ink" htmlFor="motivo-texto">
          Motivo
        </label>
        <textarea
          id="motivo-texto"
          ref={ref}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (erro) setErro(null);
          }}
          maxLength={500}
          rows={4}
          className="mt-1 w-full rounded-xl border border-sage-200 px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-muted">{motivo.length}/500</p>
        {erro && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {erro}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Enviando…" : confirmar}
          </Button>
        </div>
      </form>
    </div>
  );
}
