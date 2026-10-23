"use client";

import { useState } from "react";
import { ShieldCheck, Wrench } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ITENS_CONFORTO } from "@/config/conforto-minimo";
import { TEXTO_PADRAO_CONFIRMADO, textoCompromissoManutencao } from "@/lib/conforto/exibicao";

/**
 * Prompt 59-A, item 4 — na página do imóvel, junto do "Bom saber": "Padrão mínimo da Viva: confirmado pelo
 * proprietário" (só quando o dono confirmou todos os itens; anúncio de exemplo nunca) com o link "O que é o padrão
 * mínimo", e o compromisso de manutenção da Viva, que vale para todo imóvel.
 */
export function PadraoMinimoImovel({ confirmado }: { confirmado: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section aria-labelledby="padrao-minimo-title" data-testid="padrao-minimo-imovel">
      <h2 id="padrao-minimo-title" className="sr-only">
        Padrão mínimo e manutenção
      </h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {confirmado && (
          <li className="flex items-start gap-3 px-4 py-3" data-testid="padrao-minimo-confirmado">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
            <span className="min-w-0 text-sm text-ink">
              {TEXTO_PADRAO_CONFIRMADO}
              <button
                type="button"
                onClick={() => setAberto(true)}
                className="mt-1 block text-sm font-semibold text-forest underline underline-offset-2"
                data-testid="padrao-minimo-o-que-e"
              >
                O que é o padrão mínimo
              </button>
            </span>
          </li>
        )}
        <li className="flex items-start gap-3 px-4 py-3" data-testid="compromisso-manutencao">
          <Wrench className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <span className="min-w-0 text-sm text-ink">{textoCompromissoManutencao()}</span>
        </li>
      </ul>
      <BottomSheet open={aberto} onClose={() => setAberto(false)} title="O que é o padrão mínimo" testId="padrao-minimo-folha">
        <p className="text-sm text-muted">
          Os 10 itens que todo imóvel da Viva tem. O proprietário confirma cada um ao anunciar, e você confere na entrada.
          O que não conferir vira pendência com prazo para o proprietário corrigir.
        </p>
        <ul className="mt-4 space-y-3">
          {ITENS_CONFORTO.map((i) => (
            <li key={i.chave} className="text-sm" data-testid={`padrao-minimo-folha-${i.chave}`}>
              <span className="block font-semibold text-ink">{i.rotulo}</span>
              <span className="block text-muted">{i.criterio}</span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </section>
  );
}
