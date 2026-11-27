"use client";

import { EscolhaUnica } from "@/components/anuncio/escolha-assistente";
import { FAIXAS, FORMAS, PADRAO_RECOMENDADO, ROTULO_FORMA, type EscolhaPagamento, type FormaPagamento } from "@/lib/pagamento-forma/regras";

/**
 * E647 — o dono escolhe a forma de pagamento que aceita, em cada faixa de estadia (a Viva não impõe). O desenho anterior vem
 * pré-selecionado e marcado como recomendado. Só aparece com a chave FORMA_PAGAMENTO_DONO_ATIVA (quem renderiza confere).
 */
export function FormaPagamentoCampo({ value, onChange }: { value: EscolhaPagamento; onChange: (v: EscolhaPagamento) => void }) {
  return (
    <div className="mt-6 rounded-xl border border-line p-4" data-testid="forma-pagamento">
      <h3 className="text-sm font-semibold text-ink">Forma de pagamento que você aceita</h3>
      <p className="mt-1 text-xs text-muted">
        Você decide, em cada faixa de estadia. O morador vê a sua escolha antes de fazer a proposta. O pagamento é feito direto a você. A taxa da Viva acompanha a
        forma: no bloco completo, na assinatura; no mensal, mês a mês.
      </p>
      <div className="mt-3 grid gap-4">
        {FAIXAS.map((f) => (
          <EscolhaUnica<FormaPagamento>
            key={f.id}
            testid={`forma-pagamento-${f.id}`}
            legenda={`Estadias de ${f.rotulo}`}
            colunas={1}
            valor={value[f.id]}
            onChange={(v) => onChange({ ...value, [f.id]: v })}
            opcoes={FORMAS.map((forma) => ({ valor: forma, rotulo: ROTULO_FORMA[forma], dica: forma === PADRAO_RECOMENDADO[f.id] ? "Recomendado" : undefined }))}
          />
        ))}
      </div>
    </div>
  );
}
