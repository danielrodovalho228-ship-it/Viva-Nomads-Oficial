"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * E953 — a confirmação de "Excluir rascunho" em Meus imóveis: um PAINEL abaixo da fileira de ações do cartão, na largura
 * do cartão (antes ela abria espremida na coluna do botão de 36 px). Nomeia o rascunho (texto do E515), "Excluir" e
 * "Cancelar"; o foco vai para o painel ao abrir e Esc cancela. Durante a exclusão, "Excluindo…" e os botões travados.
 * O erro aparece AQUI DENTRO (role="alert"), junto da confirmação — o cartão fica.
 */
export function ConfirmarExcluirRascunho({
  id,
  aviso,
  ocupado,
  erro,
  onConfirmar,
  onCancelar,
}: {
  id: string;
  aviso: string;
  ocupado: boolean;
  erro: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    painel.current?.focus();
  }, []);
  const idAviso = `excluir-rascunho-aviso-${id}`;
  return (
    <div
      ref={painel}
      role="alertdialog"
      aria-labelledby={idAviso}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !ocupado) {
          e.stopPropagation();
          onCancelar();
        }
      }}
      className="mt-3 w-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-forest"
      data-testid="excluir-rascunho-confirmacao"
    >
      <p id={idAviso} className="break-words">
        {aviso}
      </p>
      {erro && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-700" data-testid="excluir-rascunho-erro">
          {erro}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" disabled={ocupado} onClick={onConfirmar} data-testid="excluir-rascunho-confirmar">
          {ocupado ? "Excluindo…" : "Excluir"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={onCancelar} data-testid="excluir-rascunho-cancelar">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
