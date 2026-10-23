"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NIVEIS, ROTULO_NIVEL } from "@/config/niveis";
import { CRITERIO_NIVEL, textoDiferenciais, textoExtras, textoRuido, tituloNivel } from "@/lib/niveis/exibicao";
import type { NivelNaFicha } from "@/lib/data/exibicao-59";

/**
 * Adendo 59.1, Parte A — bloco "Nível Conforto" na página do imóvel, junto do "Bom saber": o critério em uma frase, as
 * áreas acima do nível, o ruído como fato, os extras e "· vistoriado" quando houver vistoria. Sem nível calculado (ou
 * abaixo do Essencial), o bloco não aparece. Nível é fato, não selo.
 */
export function NivelImovel({ dados }: { dados: NivelNaFicha | null | undefined }) {
  const [aberto, setAberto] = useState(false);
  const titulo = tituloNivel(dados?.nivel, dados?.vistoriado);
  if (!dados || !titulo || dados.nivel === "em_adequacao") return null;
  const diferenciais = textoDiferenciais(dados.diferenciais);
  const ruido = textoRuido(dados.ruidoClasse, dados.isolamento);
  const extras = textoExtras(dados.extras);
  return (
    <section aria-labelledby="nivel-imovel-title" className="rounded-xl border border-line bg-white p-4" data-testid="nivel-imovel" data-nivel={dados.nivel}>
      <div className="flex items-start gap-3">
        <Award className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
        <div className="min-w-0">
          <h2 id="nivel-imovel-title" className="text-base font-semibold text-ink" data-testid="nivel-titulo">
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-muted" data-testid="nivel-criterio">
            {CRITERIO_NIVEL[dados.nivel]}
          </p>
        </div>
      </div>
      {(diferenciais || ruido || extras) && (
        <dl className="mt-3 divide-y divide-line border-t border-line text-sm">
          {diferenciais && (
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3" data-testid="nivel-diferenciais">
              <dt className="shrink-0 text-muted sm:w-32">Acima do nível</dt>
              <dd className="min-w-0 text-ink">{diferenciais}</dd>
            </div>
          )}
          {ruido && (
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3" data-testid="nivel-ruido">
              <dt className="shrink-0 text-muted sm:w-32">Ruído</dt>
              <dd className="min-w-0 text-ink">{ruido}</dd>
            </div>
          )}
          {extras && (
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3" data-testid="nivel-extras">
              <dt className="shrink-0 text-muted sm:w-32">Extras</dt>
              <dd className="min-w-0 text-ink">{extras}</dd>
            </div>
          )}
        </dl>
      )}
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 text-sm font-semibold text-forest underline underline-offset-2"
        data-testid="nivel-como-funciona"
      >
        Como funcionam os níveis
      </button>
      <BottomSheet open={aberto} onClose={() => setAberto(false)} title="Como funcionam os níveis" testId="nivel-folha">
        <ul className="space-y-4">
          {NIVEIS.map((n) => (
            <li key={n} className="text-sm" data-testid={`nivel-folha-${n}`}>
              <span className="block font-semibold text-ink">{ROTULO_NIVEL[n]}</span>
              <span className="block text-muted">{CRITERIO_NIVEL[n]}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-4 list-disc space-y-1 pl-4 text-sm text-muted">
          <li>O nível é o da área mais fraca do imóvel: sono, clima, banho, cozinha, sala, trabalho, internet, lavanderia e ruído.</li>
          <li>Áreas acima do nível aparecem como “Acima do nível”.</li>
          <li>O morador confere os itens na entrada. Item que não confere tira o nível até o proprietário corrigir.</li>
          <li>Nível não é selo e não muda a ordem da busca.</li>
        </ul>
      </BottomSheet>
    </section>
  );
}
