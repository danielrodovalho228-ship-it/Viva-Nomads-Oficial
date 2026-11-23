"use client";

import { useEffect, useState } from "react";
import { getTaxaDaConta, type TaxaDaConta } from "@/lib/data/planos-actions";
import { textoTaxaNaConta } from "@/lib/planos/gestor";
import { FRASE_ESCADA_TAXAS } from "@/config/textos-regulados";

/**
 * Conta › Plano (no cartão de Pagamentos, só para o proprietário). Prompt 078 (16/11/2026): no lugar da elegibilidade
 * do Plano Gestor, a taxa de serviço que vale hoje para a conta (a mesma leitura que congela a taxa no aceite), a
 * escada e a linha das carteiras — tudo da fonte única. SEM botão de assinar: não há plano pago.
 */
export function PlanoGestorConta() {
  const [t, setT] = useState<TaxaDaConta | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    getTaxaDaConta()
      .then((r) => vivo && setT(r))
      .catch(() => vivo && setT(null));
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <section id="plano" className="scroll-mt-24 rounded-xl border border-line bg-white p-4" data-testid="conta-plano-gestor" aria-labelledby="conta-plano-titulo">
      <h2 id="conta-plano-titulo" className="font-title text-2xl font-semibold text-ink">
        Plano
      </h2>
      <p className="mt-2 text-sm text-ink" data-testid="conta-plano-gestor-texto" data-taxa={t ? String(t.taxa) : undefined} data-origem={t?.origem}>
        {t === undefined ? "Carregando…" : t ? textoTaxaNaConta(t) : FRASE_ESCADA_TAXAS}
      </p>
    </section>
  );
}
