"use client";

import { useState } from "react";
import { aoTocarToggle } from "@/lib/anuncio/bloco-opcional";
import { cn } from "@/lib/utils";

/**
 * Bloco opcional do formulário (padrão E56): toggle claro no topo; desligado, o grupo não aparece; ligar abre o grupo
 * inteiro; desligar com dados pede confirmação aqui mesmo (sem diálogo do navegador) e, confirmado, chama `onDesligar`
 * para o formulário limpar os dados do grupo. O estado inicial (`ligado`) vem de `nasceLigado(temDadosSalvos)`.
 */
export function BlocoOpcional({
  id,
  titulo,
  descricao,
  ligado,
  temDados,
  onLigar,
  onDesligar,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: string;
  ligado: boolean;
  /** O grupo tem algo preenchido agora (decide se desligar pede confirmação). */
  temDados: boolean;
  onLigar: () => void;
  /** Desligar confirmado: o formulário apaga os dados do grupo e desliga. */
  onDesligar: () => void;
  children: React.ReactNode;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const tocar = () => {
    const acao = aoTocarToggle(ligado, temDados);
    if (acao === "ligar") onLigar();
    else if (acao === "desligar") onDesligar();
    else setConfirmando(true);
  };
  return (
    <div className="rounded-xl border border-line bg-white" data-testid={`bloco-${id}`} data-ligado={ligado ? "sim" : "nao"}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 id={`bloco-${id}-titulo`} className="text-sm font-semibold text-ink">
            {titulo}
          </h3>
          {descricao && <p className="mt-1 text-xs text-muted">{descricao}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ligado}
          aria-labelledby={`bloco-${id}-titulo`}
          onClick={tocar}
          data-testid={`bloco-${id}-toggle`}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
            ligado ? "bg-forest" : "bg-sage-200"
          )}
        >
          <span className={cn("inline-block h-5 w-5 rounded-full bg-white transition-transform", ligado ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      {confirmando && (
        <div role="alertdialog" aria-labelledby={`bloco-${id}-confirmar-texto`} className="mx-4 mb-4 rounded-lg bg-surface-2 p-3" data-testid={`bloco-${id}-confirmar`}>
          <p id={`bloco-${id}-confirmar-texto`} className="text-sm text-ink">
            Desligar “{titulo}” apaga o que você preencheu neste grupo quando salvar. Quer desligar?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink"
              onClick={() => {
                setConfirmando(false);
                onDesligar();
              }}
              data-testid={`bloco-${id}-confirmar-desligar`}
            >
              Desligar e apagar
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-forest underline underline-offset-4"
              onClick={() => setConfirmando(false)}
              data-testid={`bloco-${id}-confirmar-manter`}
            >
              Manter
            </button>
          </div>
        </div>
      )}
      {ligado && (
        <div className="grid gap-4 border-t border-line p-4" data-testid={`bloco-${id}-conteudo`}>
          {children}
        </div>
      )}
    </div>
  );
}
