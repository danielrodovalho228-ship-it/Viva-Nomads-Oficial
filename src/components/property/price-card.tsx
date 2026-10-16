import { FileText, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { hojeBR, formatBRL } from "@/lib/utils";
import { calcularTudoIncluido } from "@/lib/precos";
import { SELO_NF_UI } from "@/lib/flags";
import { linhasDeTaxas } from "@/lib/reserva-imovel";

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
  const hoje = hojeBR();
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
  const allIncluded = inc.total;
  const availableFrom = disponivelFuturo(property.availableFrom);

  return (
    <div id="cartao-preco" className="sticky top-36 scroll-mt-36 rounded-2xl border border-sage-200 bg-white p-5 xl:p-6 shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className="font-title text-3xl font-bold text-forest">
          {formatBRL(property.monthlyPrice)}
        </span>
        <span className="text-muted">/mês</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">R$ 0 de taxa para você: o inquilino não paga nada à plataforma.</p>

      {allIncluded > property.monthlyPrice && (
        <p className="mt-1 text-sm text-muted">
          ≈ {formatBRL(allIncluded)}/mês com tudo incluído
        </p>
      )}

      {/* Taxas itemizadas — só o que o dono informou; Caução em linha separada. */}
      <ul data-testid="taxas-itemizadas" className="mt-3 space-y-2 rounded-lg bg-surface-2 px-3 py-3 text-sm">
        {linhasDeTaxas(property).map((l) => (
          <li key={l.chave} data-taxa={l.chave} className={l.chave === "caucao" ? "border-t border-line pt-2" : undefined}>
            <div className="flex items-baseline justify-between gap-3 text-ink">
              <span className={l.chave === "mensal" ? "font-medium" : "text-muted"}>{l.rotulo}</span>
              {l.valor && <span className={l.chave === "viva" ? "font-semibold text-forest" : "font-medium"}>{l.valor}</span>}
            </div>
            {l.nota && <p className="text-xs text-muted">{l.nota}</p>}
          </li>
        ))}
        {SELO_NF_UI && property.issuesInvoice && (
          <li className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
            <FileText className="h-3.5 w-3.5" /> Emite Nota Fiscal do valor mensal
          </li>
        )}
      </ul>

      {/* Ações (Solicitar reserva / Enviar mensagem / WhatsApp) — vêm da página */}
      <div className="mt-3">{actions}</div>

      <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-sage">
        <span className="h-2 w-2 rounded-full bg-sage" />
        {availableFrom ? `Disponível a partir de ${availableFrom}` : "Disponível agora"}
      </p>

      {/* Promoção do Inquilino Verificado no funil — leva à verificação já no
          contexto de INQUILINO (candidatura é ação de inquilino), mesmo que quem
          navega seja um proprietário-admin. */}
      <Link
        href="/dashboard/verificacao?como=inquilino"
        className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-800 transition-colors hover:bg-blue-100"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <span>
          <strong>Verificação de identidade: em breve.</strong> Por enquanto, candidate-se direto pela plataforma.
        </span>
      </Link>

      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
        <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Endereço exato liberado após o aceite da candidatura. Antes, mostramos a região
        aproximada ({property.neighborhood}).
      </p>
      <p className="mt-3 text-center text-xs text-muted">
        O valor mensal é pago direto ao proprietário. A plataforma conecta e documenta —
        não participa do pagamento.
      </p>
    </div>
  );
}
