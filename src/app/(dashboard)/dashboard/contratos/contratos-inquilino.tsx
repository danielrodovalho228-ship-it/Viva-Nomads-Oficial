import Link from "next/link";
import { FileSignature } from "lucide-react";
import { Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { ContratoInquilinoView } from "@/lib/data/contratos-actions";
import { formatBRL } from "@/lib/utils";

/**
 * Contratos do INQUILINO (prompt 28): um contrato aguardando assinatura ainda não é uma locação. Cada contrato mostra
 * o número, o imóvel, a situação real (a mesma do Fechamento e da página do contrato) e "Assinar agora" quando falta
 * ele; liga à página do contrato e à locação, quando existir.
 */
export function ContratosInquilino({ contratos }: { contratos: ContratoInquilinoView[] }) {
  if (contratos.length === 0) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Nenhum contrato ainda"
        text="Quando uma candidatura sua for aceita e o proprietário gerar o contrato, ele aparece aqui para você assinar."
        action={
          <ButtonLink href="/dashboard/candidaturas" variant="primary">
            Minhas candidaturas
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="grid gap-3" data-testid="contratos-inquilino">
      {contratos.map((c) => (
        <Panel key={c.id} data-testid="contrato-inquilino" data-chave={c.chave}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.numero}</p>
              <h3 className="line-clamp-2 font-title text-base font-bold text-ink">{c.propertyTitle}</h3>
              <p className="text-xs text-muted">{formatBRL(c.aluguelMensal)}/mês</p>
            </div>
            <span
              data-testid="contrato-inquilino-estado"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${c.faltaVoce ? "bg-amber-100 text-amber-900" : "bg-sage-100 text-forest"}`}
            >
              {c.texto}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {c.faltaVoce ? (
              <ButtonLink href={`/dashboard/contratos/${c.id}`} variant="primary" size="sm" data-testid="contrato-inquilino-assinar">
                Assinar agora
              </ButtonLink>
            ) : (
              <Link href={`/dashboard/contratos/${c.id}`} className="font-medium text-forest underline" data-testid="contrato-inquilino-ver">
                Ver contrato
              </Link>
            )}
            {c.chave !== "aguardando_assinatura" && (
              <Link href={`/dashboard/locacoes/${c.id}`} className="font-medium text-forest underline" data-testid="contrato-inquilino-locacao">
                Ver locação
              </Link>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}
