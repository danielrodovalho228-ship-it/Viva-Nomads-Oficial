"use client";

import { useEffect, useState } from "react";
import { getGestorElegibilidade, type GestorElegibilidade } from "@/lib/data/planos-actions";
import { textoElegibilidadeGestor } from "@/lib/planos/gestor";

/**
 * E224 — Conta › Plano (no cartão de Pagamentos, só para o proprietário): quantos imóveis com documento aprovado
 * ele tem e quantos faltam para o Plano Gestor; liberado → "Fale com a Viva para ativar". SEM botão de assinar: a
 * cobrança não está ligada, então a tela não promete pagamento online.
 */
export function PlanoGestorConta() {
  const [e, setE] = useState<GestorElegibilidade | null>(null);
  useEffect(() => {
    let vivo = true;
    getGestorElegibilidade()
      .then((r) => vivo && setE(r))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <section id="plano" className="scroll-mt-24 rounded-xl border border-line bg-white p-4" data-testid="conta-plano-gestor" aria-labelledby="conta-plano-titulo">
      <h2 id="conta-plano-titulo" className="font-title text-2xl font-semibold text-ink">
        Plano
      </h2>
      <p className="mt-2 text-sm text-ink" data-testid="conta-plano-gestor-texto" data-elegivel={e ? (e.elegivel ? "1" : "0") : undefined}>
        {e ? textoElegibilidadeGestor(e) : "Carregando…"}
      </p>
    </section>
  );
}
