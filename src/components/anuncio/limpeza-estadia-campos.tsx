"use client";

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

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";

export function LimpezaEstadiaCampos({ value, onChange }: { value: LimpezaEstadiaForm; onChange: (v: LimpezaEstadiaForm) => void }) {
  return (
    <div className="grid gap-4 rounded-xl border border-line bg-white p-4" data-testid="limpeza-estadia">
      <div>
        <h3 className="text-sm font-semibold text-ink">Limpeza durante a estadia</h3>
        <p className="mt-1 text-xs text-muted">Opcional. Aparece no anúncio, na proposta e no resumo do contrato, com a quantidade por mês.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Limpezas incluídas por mês</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {QTDS_LIMPEZA.map((q) => (
            <label key={q} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-4 text-sm">
              <input type="radio" name="limpeza-por-mes" checked={value.porMes === q} onChange={() => onChange({ ...value, porMes: q })} />
              {q === 0 ? "Nenhuma" : q}
            </label>
          ))}
        </div>
      </fieldset>
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
            <input
              className={campo}
              inputMode="decimal"
              value={value.valorMes}
              placeholder="0 = já incluído no valor mensal"
              onChange={(e) => onChange({ ...value, valorMes: e.target.value })}
              data-testid="limpeza-valor"
            />
          </label>
        </>
      )}
    </div>
  );
}
