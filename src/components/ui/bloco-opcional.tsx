"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { aoDesligar } from "@/lib/ui/bloco-opcional";

/**
 * C9/E56 — o toggle dos blocos opcionais: a pergunta à esquerda, o interruptor à direita. Desligado, nada do grupo
 * aparece; ligado, o grupo inteiro (children). Desligar com dados salvos mostra a confirmação aqui mesmo e só limpa
 * (onLimpar) depois do "Remover".
 */
export function BlocoOpcional(p: {
  pergunta: string;
  ligado: boolean;
  onLigado: (v: boolean) => void;
  temDados: boolean;
  textoConfirmar: string;
  onLimpar: () => Promise<boolean>;
  testId: string;
  children: React.ReactNode;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    setErro(null);
    if (!p.ligado) return p.onLigado(true);
    if (aoDesligar(p.temDados) === "fechar") return p.onLigado(false);
    setConfirmando(true);
  }

  async function remover() {
    setLimpando(true);
    const ok = await p.onLimpar().catch(() => false);
    setLimpando(false);
    if (!ok) return setErro("Não foi possível remover agora. Tente de novo.");
    setConfirmando(false);
    p.onLigado(false);
  }

  return (
    <div data-testid={p.testId} data-ligado={p.ligado ? "1" : "0"}>
      <div className="flex items-center justify-between gap-4">
        <span id={`${p.testId}-pergunta`} className="text-sm font-semibold text-ink">
          {p.pergunta}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={p.ligado}
          aria-labelledby={`${p.testId}-pergunta`}
          onClick={alternar}
          disabled={confirmando || limpando}
          data-testid={`${p.testId}-toggle`}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:opacity-60",
            p.ligado ? "bg-forest" : "bg-line",
          )}
        >
          <span className={cn("inline-block h-5 w-5 rounded-full bg-white transition-transform", p.ligado ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      {confirmando && (
        <div className="mt-3 rounded-xl border border-red-200 bg-white p-4" role="alertdialog" aria-labelledby={`${p.testId}-confirma-texto`} data-testid={`${p.testId}-confirma`}>
          <p id={`${p.testId}-confirma-texto`} className="text-sm text-ink">
            {p.textoConfirmar}
          </p>
          {erro && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {erro}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={remover} disabled={limpando} className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700 underline underline-offset-4 disabled:opacity-60" data-testid={`${p.testId}-confirma-remover`}>
              {limpando ? "Removendo…" : "Remover"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} disabled={limpando} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4" data-testid={`${p.testId}-confirma-manter`}>
              Manter
            </button>
          </div>
        </div>
      )}
      {p.ligado && <div className="mt-4">{p.children}</div>}
    </div>
  );
}
