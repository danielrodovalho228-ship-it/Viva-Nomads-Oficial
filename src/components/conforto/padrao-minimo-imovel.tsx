"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ITENS_CONFORTO } from "@/config/conforto-minimo";
import { TEXTO_PADRAO_CONFIRMADO } from "@/lib/conforto/exibicao";

/**
 * Prompt 59-A, item 4 — na página do imóvel, junto do "Bom saber": "Padrão mínimo da Viva: confirmado pelo
 * proprietário" (só quando o dono confirmou todos os itens; anúncio de exemplo nunca) com o link "O que é o padrão
 * mínimo". E98-A: o compromisso de manutenção virou uma linha do "Bom saber"; sem o padrão confirmado, nada aparece.
 */
export function PadraoMinimoImovel({ confirmado }: { confirmado: boolean }) {
  const [aberto, setAberto] = useState(false);
  if (!confirmado) return null;
  return (
    <section aria-labelledby="padrao-minimo-title" data-testid="padrao-minimo-imovel">
      <h2 id="padrao-minimo-title" className="sr-only">
        Padrão mínimo
      </h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
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
      </ul>
      <BottomSheet open={aberto} onClose={() => setAberto(false)} title="O que é o padrão mínimo" testId="padrao-minimo-folha">
        <p className="text-sm text-muted">
          Os {ITENS_CONFORTO.length} itens que todo imóvel da Viva tem. O proprietário confirma cada um ao anunciar, e você confere na entrada.
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
