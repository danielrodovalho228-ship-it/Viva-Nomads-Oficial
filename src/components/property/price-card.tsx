import { FileText, MapPinned } from "lucide-react";
import type { Property } from "@/lib/types";
import { hojeBR, formatBRL } from "@/lib/utils";
import { calcularTotalMensal } from "@/lib/precos";
import { SELO_NF_UI } from "@/lib/flags";
import { linhasDeTaxas } from "@/lib/reserva-imovel";
import { fraseDescontoCard, ROTULO_VALOR_FIXO } from "@/lib/anuncio/negociacao";
import { rotuloPrecoCartao } from "@/lib/cartao-preco";
import { FRASE_NAO_SEGURA_DINHEIRO } from "@/config/dinheiro";

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
 * Cartão lateral (fixo no desktop, empilhado no celular — Prompt 41): no topo "R$ X/mês · R$ Y em N meses"
 * (N = 1 → só "/mês", a regra do cartão da busca), "A Viva não segura dinheiro", o detalhamento do total do mês,
 * os pagamentos fora do total, a disponibilidade e as ações (recebidas via `actions`, com UM primário: "Solicitar").
 * No desktop o cartão fica preso ao rolar; se for mais alto que a tela, rola por dentro (nunca some da vista). A frase
 * "não segura dinheiro" fica só no topo (sem repetir no pé, para o cartão caber na coluna até as Avaliações).
 */
export function PriceCard({ property, actions, meses = 1 }: { property: Property; actions: React.ReactNode; meses?: number }) {
  // Custo total do mês pela FONTE ÚNICA — o mesmo número do cartão da busca e da barra do celular.
  const mes = calcularTotalMensal(property);
  const preco = rotuloPrecoCartao(mes.total, meses);
  const availableFrom = disponivelFuturo(property.availableFrom);

  return (
    <div id="cartao-preco" className="sticky top-36 scroll-mt-36 rounded-xl border border-line bg-white p-5 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto xl:p-6">
      <p className="tabular-nums" data-testid="cartao-lateral-preco">
        <span className="text-xl font-semibold text-ink" data-testid="cartao-lateral-mes">
          {preco.valor}
        </span>
        <span className="text-sm text-ink">/mês</span>
        {preco.estadia && (
          <span className="text-sm text-muted" data-testid="cartao-lateral-estadia">
            {" "}
            · {preco.estadia}
          </span>
        )}
      </p>
      <p className="mb-4 text-xs text-muted" data-testid="cartao-nao-segura">
        {FRASE_NAO_SEGURA_DINHEIRO}: o valor vai direto ao proprietário.
      </p>
      <p className="text-sm font-semibold text-ink">Quanto você paga por mês</p>
      <ul data-testid="total-mensal" className="mt-2 space-y-2 text-sm">
        {mes.linhas.map((l) => (
          <li key={l.chave} data-taxa={l.chave === "contas" ? "consumo" : l.chave} className="flex items-baseline justify-between gap-3">
            <span className={l.chave === "mensal" ? "font-medium text-ink" : "text-muted"}>{l.rotulo}</span>
            <span className={l.chave === "viva" ? "font-semibold text-forest" : "font-medium text-ink"}>{l.incluida ? "incluída" : formatBRL(l.valor)}</span>
          </li>
        ))}
        <li data-testid="total-por-mes" className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <span className="font-semibold text-ink">Total por mês</span>
          <span className="text-xl font-semibold tabular-nums text-forest">{formatBRL(mes.total)}</span>
        </li>
      </ul>
      <p className="mt-1 text-xs text-muted" data-testid="iptu-nota">IPTU não incluso no total.{mes.contasMedidas && " Água, luz e gás medidos à parte."}</p>
      <p className="mt-1 text-xs text-muted">R$ 0 de taxa para você: o inquilino não paga nada à plataforma.</p>
      {/* Negociação configurada pelo dono (prompt 17 §8): "Valor fixo" ou o desconto por estadia mais longa. */}
      {property.negociacao && (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="negociacao-anuncio">
          {!property.negociacao.aceita && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink">{ROTULO_VALOR_FIXO}</span>
          )}
          {property.negociacao.aceita && (
            <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">Aceita negociar</span>
          )}
          {fraseDescontoCard(property.negociacao.descontos) && (
            <span className="rounded-full bg-champagne/30 px-3 py-1 text-xs font-semibold text-forest" data-testid="desconto-estadia">
              {fraseDescontoCard(property.negociacao.descontos)}
            </span>
          )}
        </div>
      )}

      {/* Fora do total: pagamentos únicos, pet e Caução (devolvida após a conferência de saída). */}
      <ul data-testid="taxas-itemizadas" className="mt-3 space-y-2 rounded-lg bg-surface-2 px-3 py-3 text-sm">
        <li className="text-xs font-semibold uppercase text-muted">Fora do total mensal</li>
        {linhasDeTaxas(property)
          .filter((l) => ["preparacao", "saida", "pet", "caucao"].includes(l.chave))
          .map((l) => (
            <li key={l.chave} data-taxa={l.chave} className={l.chave === "caucao" ? "border-t border-line pt-2" : undefined}>
              <div className="flex items-baseline justify-between gap-3 text-ink">
                <span className="text-muted">{l.rotulo}</span>
                {l.valor && <span className="font-medium">{l.valor}</span>}
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

      {/* Ações (Enviar candidatura / Enviar mensagem / WhatsApp) — vêm da página */}
      <div className="mt-3">{actions}</div>

      <p className="mt-4 inline-flex items-center gap-2 text-sm text-sage">
        <span className="h-2 w-2 rounded-full bg-sage" />
        {availableFrom ? `Disponível a partir de ${availableFrom}` : "Disponível agora"}
      </p>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <MapPinned className="mt-1 h-3.5 w-3.5 shrink-0" />
        Endereço exato liberado após o aceite da candidatura. Antes, mostramos a região
        aproximada ({property.neighborhood}).
      </p>
    </div>
  );
}
