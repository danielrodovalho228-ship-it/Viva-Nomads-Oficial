import { ShieldCheck } from "lucide-react";
import { DELIMITACAO_LAUDO } from "@/config/checklist-avaliacao";
import type { ExibicaoAvaliacao } from "@/lib/vistoria/laudo";
import { linhaAvaliadoEm, linhaResumoGrupo } from "@/lib/vistoria/telas-laudo";

/**
 * Prompt 62-A, Parte 2, item 11: na página do imóvel, logo abaixo do nível, a avaliação vigente: "Avaliado em [data]
 * por avaliador credenciado nº X", o resumo por grupo e "Ver laudo" (a conferência pública do VIS). Sem laudo vigente
 * (ou reprovado, ou com strike), a função da Pista B devolve null e o bloco não aparece.
 */
export function AvaliacaoFicha({ dados }: { dados: ExibicaoAvaliacao | null | undefined }) {
  if (!dados) return null;
  return (
    <section aria-labelledby="avaliacao-ficha-title" className="rounded-xl border border-line bg-white p-4" data-testid="avaliacao-ficha">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
        <div className="min-w-0">
          <h2 id="avaliacao-ficha-title" className="text-base font-semibold text-ink">
            Avaliação do imóvel
          </h2>
          <p className="mt-1 text-sm text-muted" data-testid="avaliacao-ficha-linha">
            {linhaAvaliadoEm(dados.vistoriadoEm, dados.numeroCredenciado)}
          </p>
        </div>
      </div>
      {dados.resumoPorGrupo.length > 0 && (
        <dl className="mt-3 grid gap-x-6 border-t border-line text-sm sm:grid-cols-2" data-testid="avaliacao-ficha-resumo">
          {dados.resumoPorGrupo.map((g) => (
            <div key={g.grupo} className="flex justify-between gap-3 border-b border-line py-2">
              <dt className="text-ink">{g.rotulo}</dt>
              <dd className="text-muted">{linhaResumoGrupo(g)}</dd>
            </div>
          ))}
        </dl>
      )}
      <a href={dados.linkConferir} className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-2" data-testid="avaliacao-ver-laudo">
        Ver laudo
      </a>
      <p className="mt-2 text-xs text-muted" data-testid="avaliacao-ficha-delimitacao">{DELIMITACAO_LAUDO}</p>
    </section>
  );
}
