import { ChevronDown, FileText, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { calcularTudoIncluido } from "@/lib/precos";
import { SELO_NF_UI } from "@/lib/flags";
import { MatchGuaranteeNotice } from "@/components/legal-notice";

/** Formata uma data ISO (YYYY-MM-DD) para DD/MM/AAAA. */
function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : null;
}

/**
 * Data de disponibilidade FUTURA em pt-BR, ou null se a data já passou (ou é
 * hoje) — nesse caso a UI mostra "Disponível agora" (A7 do E2E: nada de data no
 * passado). Compara strings ISO (yyyy-mm-dd), sem fuso.
 */
function disponivelFuturo(iso?: string): string | null {
  if (!iso) return null;
  const dia = iso.slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  return dia > hoje ? formatDate(dia) : null;
}

/**
 * Card de preço lateral (sticky no desktop, no topo no mobile). Mostra o valor/mês,
 * o "tudo incluído", o detalhamento de custo expansível, a disponibilidade e os
 * botões de ação (recebidos via `actions`). Mantém a regra de ouro visível.
 */
export function PriceCard({ property, actions }: { property: Property; actions: React.ReactNode }) {
  // "Tudo incluído" pela FONTE ÚNICA — o mesmo número do card da busca.
  const inc = calcularTudoIncluido(property);
  const condo = inc.condominio;
  const allIncluded = inc.total;
  const availableFrom = disponivelFuturo(property.availableFrom);

  return (
    <div className="sticky top-20 rounded-2xl border border-sage-200 bg-white p-6 shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className="font-title text-3xl font-bold text-forest">
          {formatBRL(property.monthlyPrice)}
        </span>
        <span className="text-muted">/mês</span>
      </div>

      {allIncluded > property.monthlyPrice && (
        <p className="mt-1 text-sm text-muted">
          ≈ {formatBRL(allIncluded)}/mês com tudo incluído
        </p>
      )}

      {/* Composição do custo — transparente, sem sobrecarregar */}
      <details className="group mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ink">
          Detalhes do custo
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-1.5">
          <Line label="Aluguel" value={formatBRL(property.monthlyPrice)} />
          {condo > 0 && <Line label="Condomínio" value={formatBRL(condo)} />}
          {property.utilitiesMode === "fixed" && property.utilitiesEstimate > 0 ? (
            <p className="text-ink">
              + consumo estimado <strong>{formatBRL(property.utilitiesEstimate)}</strong>/mês
              <span className="block text-xs text-muted">
                Água, luz e gás em valor fixo no contrato (ajuste se exceder{" "}
                {property.utilitiesOverageMargin}%).
              </span>
            </p>
          ) : (
            <p className="text-ink">
              + consumo conforme medição
              <span className="block text-xs text-muted">
                Contas repassadas ao inquilino mediante comprovante.
              </span>
            </p>
          )}
          {property.prepFee > 0 && (
            <p className="text-ink">
              + preparação <strong>{formatBRL(property.prepFee)}</strong>
              <span className="block text-xs text-muted">
                Limpeza profunda antes da entrada — cobrada uma única vez.
              </span>
            </p>
          )}
          {SELO_NF_UI && property.issuesInvoice && (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
              <FileText className="h-3.5 w-3.5" /> Emite Nota Fiscal do aluguel
            </p>
          )}
          <p className="text-xs text-sage">Sem taxa da plataforma para o inquilino.</p>
        </div>
      </details>

      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-sage">
        <span className="h-2 w-2 rounded-full bg-sage" />
        {availableFrom ? `Disponível a partir de ${availableFrom}` : "Disponível agora"}
      </p>

      {/* Promoção do Inquilino Verificado no funil — leva à verificação já no
          contexto de INQUILINO (candidatura é ação de inquilino), mesmo que quem
          navega seja um proprietário-admin. */}
      <Link
        href="/dashboard/verificacao?como=inquilino"
        className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-800 transition-colors hover:bg-blue-100"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <span>
          <strong>Verifique-se uma vez</strong> e candidate-se a qualquer imóvel com um clique.
        </span>
      </Link>

      {/* Ações (Candidatar-se / Tirar dúvida / Agendar visita) — vêm da página */}
      <div className="mt-3">{actions}</div>

      <MatchGuaranteeNotice className="mt-4" />

      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
        <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Endereço exato liberado após o aceite da candidatura. Antes, mostramos a região
        aproximada ({property.neighborhood}).
      </p>
      <p className="mt-3 text-center text-xs text-muted">
        O pagamento do aluguel é feito direto ao proprietário. A plataforma conecta e documenta —
        não intermedeia a transação.
      </p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
