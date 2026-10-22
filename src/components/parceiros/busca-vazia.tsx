import { UserPlus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AvisoFotografo } from "@/app/(public)/parceiros/fotografos/aviso-fotografo";
import { mostrarParceiroGeral, rotuloCategoria, type ParceiroGeral } from "@/lib/parceiros/regras";

/**
 * Busca sem parceiro (Prompt 31a, item 6): avise-me (qualquer categoria), "Indique um profissional" e, se a equipe
 * ligar a chave PARCEIRO_GERAL_FALLBACK, o cartão do parceiro geral (sem logo de terceiros).
 */
export function BuscaVazia({
  categoria,
  cidade,
  uf,
  logado,
  voltarPara,
  autoAvisar,
  geral,
}: {
  categoria: string;
  cidade: string;
  uf: string;
  logado: boolean;
  voltarPara: string;
  autoAvisar: boolean;
  geral: ParceiroGeral;
}) {
  return (
    <div className="mt-4 space-y-4" data-testid="busca-parceiros-vazia">
      {/* Uma frase = um texto só: em pedaços, leitores que aparam cada pedaço colavam as palavras (QA 22/10). */}
      <p className="text-ink" data-testid="busca-parceiros-vazia-texto">
        {`Ainda não temos parceiro${categoria ? ` de ${rotuloCategoria(categoria).toLowerCase()}` : ""}${cidade ? ` em ${cidade}` : " nesta busca"}.`}
      </p>
      {cidade && <AvisoFotografo cidade={cidade} uf={uf} logado={logado} voltarPara={voltarPara} autoAvisar={autoAvisar} categoria={categoria || "outro"} />}
      <div className="rounded-xl border border-line bg-white p-4" data-testid="indique-profissional">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <UserPlus className="h-5 w-5 shrink-0 text-forest" aria-hidden /> Indique um profissional
        </p>
        <p className="mt-1 text-sm text-muted">Conhece alguém bom que atende aí? Mande o link: o pedido de parceria é feito pela própria pessoa, com a conta dela.</p>
        <ButtonLink href={`/parceiros${categoria ? `?categoria=${categoria}` : ""}#quero-ser-parceiro`} variant="secondary" size="sm" className="mt-3">
          Abrir a página de parceiros
        </ButtonLink>
      </div>
      {mostrarParceiroGeral(geral, 0) && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 p-4" data-testid="parceiro-geral">
          <p className="text-xs font-semibold text-forest">Parceiro geral da Viva</p>
          <p className="mt-1 font-title text-lg font-semibold text-ink">{geral.nome}</p>
          {geral.cidade && <p className="text-sm text-muted">{geral.cidade}</p>}
          {geral.descricao && <p className="mt-2 text-sm text-ink">{geral.descricao}</p>}
          <ButtonLink href="/ajuda" variant="secondary" size="sm" className="mt-3">
            Pedir pela Central de Ajuda
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
