"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { EscolhaUnica } from "@/components/anuncio/escolha-assistente";
import { reaisOu } from "@/lib/reais";
import { QTDS_LIMPEZA, MAX_TEXTO_LIMPEZA, type LimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";

/** Rascunho do formulário: tudo em texto até o servidor validar. */
export interface LimpezaEstadiaForm {
  porMes: number;
  inclui: string;
  valorMes: string;
}

export function formDeLimpeza(l?: LimpezaEstadia): LimpezaEstadiaForm {
  return { porMes: l?.porMes ?? 0, inclui: l?.inclui ?? "", valorMes: l && l.valorMes > 0 ? String(l.valorMes) : "" };
}

// E193: o campo (texto, data, número) tem a moldura, o tamanho e o estado do cartão grande do assistente.
const campo = "w-full min-h-14 rounded-xl border-2 border-line bg-white px-4 text-sm text-ink outline-none transition-colors hover:border-sage focus:border-forest";

export function LimpezaEstadiaCampos({ value, onChange }: { value: LimpezaEstadiaForm; onChange: (v: LimpezaEstadiaForm) => void }) {
  return (
    <div className="grid gap-4 rounded-xl border border-line bg-white p-4" data-testid="limpeza-estadia">
      <div>
        <h2 className="text-sm font-semibold text-ink">Limpeza durante a estadia</h2>
        <p className="mt-1 text-xs text-muted">Opcional. Aparece no anúncio, na proposta e no resumo do contrato, com a quantidade por mês.</p>
      </div>
      <EscolhaUnica<number>
        testid="limpeza-por-mes"
        legenda="Limpezas incluídas por mês"
        valor={value.porMes}
        onChange={(porMes) => onChange({ ...value, porMes })}
        opcoes={QTDS_LIMPEZA.map((q) => ({ valor: q, rotulo: q === 0 ? "Nenhuma" : String(q) }))}
      />
      {value.porMes > 0 && (
        <>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            O que cada limpeza inclui
            <input
              className={campo}
              value={value.inclui}
              maxLength={MAX_TEXTO_LIMPEZA}
              placeholder="Ex.: pisos, banheiro, cozinha e troca de roupa de cama"
              onChange={(e) => onChange({ ...value, inclui: e.target.value })}
              data-testid="limpeza-inclui"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Valor do pacote por mês (R$)
            <CampoReais
              semPrefixo
              centavos
              className={campo}
              value={reaisOu(value.valorMes, NaN) >= 0 ? reaisOu(value.valorMes, NaN) : null}
              placeholder="0 = já incluído no valor mensal"
              onChange={(v) => onChange({ ...value, valorMes: v == null ? "" : String(v) })}
              testid="limpeza-valor"
            />
          </label>
        </>
      )}
    </div>
  );
}
