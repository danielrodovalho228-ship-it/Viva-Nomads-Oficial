"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { reaisOu } from "@/lib/reais";
import {
  ESPECIES_PET,
  PORTES_PET,
  MAX_PETS,
  MAX_TEXTO_CONDOMINIO,
  MAX_OBSERVACAO_PET,
  rotuloQtdPets,
  TIPOS_VALOR_PET,
  ROTULO_TIPO_VALOR_PET,
  ROTULO_ESPECIE,
  ROTULO_PORTE,
  type EspeciePet,
  type PortePet,
  type RegrasPets,
  type TipoValorPet,
} from "@/lib/anuncio/pets-regras";

/** Rascunho do formulário: tudo em texto até o servidor validar. E263-A: tudo opcional ("" = não informado). */
export interface RegrasPetsForm {
  especies: EspeciePet[];
  porteMax: PortePet | "";
  qtdMax: string;
  regrasCondominio: string;
  valorPet: string;
  valorPetTipo: TipoValorPet;
  taxaMensal: string;
  observacao: string;
}

export function formDeRegras(r?: RegrasPets): RegrasPetsForm {
  return {
    especies: r?.especies ?? [...ESPECIES_PET],
    porteMax: r?.porteMax ?? "",
    qtdMax: r?.qtdMax ? String(r.qtdMax) : "",
    regrasCondominio: r?.regrasCondominio ?? "",
    valorPet: r?.valorPet && r.valorPet > 0 ? String(r.valorPet) : "",
    valorPetTipo: r?.valorPetTipo ?? "reembolsavel",
    taxaMensal: r?.taxaMensal && r.taxaMensal > 0 ? String(r.taxaMensal) : "",
    observacao: r?.observacao ?? "",
  };
}

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";

export function PetsRegrasCampos({ value, onChange }: { value: RegrasPetsForm; onChange: (v: RegrasPetsForm) => void }) {
  const alternar = (e: EspeciePet) =>
    onChange({
      ...value,
      especies: value.especies.includes(e) ? value.especies.filter((x) => x !== e) : [...value.especies, e],
    });
  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-line bg-white p-4" data-testid="pets-regras">
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Quais animais você aceita?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ESPECIES_PET.map((e) => (
            <label key={e} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-4 text-sm">
              <input type="checkbox" checked={value.especies.includes(e)} onChange={() => alternar(e)} />
              {ROTULO_ESPECIE[e]}
            </label>
          ))}
        </div>
        {value.especies.length === 0 && <p className="mt-1 text-xs text-muted">Sem nenhum marcado, vale qualquer animal.</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Porte máximo
          <select className={campo} data-testid="pets-porte" value={value.porteMax} onChange={(e) => onChange({ ...value, porteMax: e.target.value as PortePet | "" })}>
            <option value="">Sem limite de porte</option>
            {PORTES_PET.map((p) => (
              <option key={p} value={p}>{ROTULO_PORTE[p]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Quantos animais, no máximo?
          <select className={campo} data-testid="pets-qtd" value={value.qtdMax} onChange={(e) => onChange({ ...value, qtdMax: e.target.value })}>
            <option value="">Sem limite</option>
            {Array.from({ length: MAX_PETS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>{rotuloQtdPets(n)}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Taxa mensal de pet (R$/mês, opcional)
        <CampoReais
          semPrefixo
          centavos
          className={campo}
          placeholder="0"
          testid="pets-taxa-mensal"
          value={reaisOu(value.taxaMensal, NaN) >= 0 ? reaisOu(value.taxaMensal, NaN) : null}
          onChange={(v) => onChange({ ...value, taxaMensal: v == null ? "" : String(v) })}
        />
        <span className="text-xs font-normal text-muted">Entra na proposta de quem tem pet; você pode ajustar ao montar.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2" data-testid="valor-pet-campos">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Valor pet (R$, opcional)
          <CampoReais
            semPrefixo
            centavos
            className={campo}
            placeholder="0"
            testid="valor-pet"
            value={reaisOu(value.valorPet, NaN) >= 0 ? reaisOu(value.valorPet, NaN) : null}
            onChange={(v) => onChange({ ...value, valorPet: v == null ? "" : String(v) })}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Esse valor é
          <select
            className={campo}
            data-testid="valor-pet-tipo"
            value={value.valorPetTipo}
            onChange={(e) => onChange({ ...value, valorPetTipo: e.target.value as TipoValorPet })}
          >
            {TIPOS_VALOR_PET.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_VALOR_PET[t]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Regra do condomínio sobre pets (opcional)
        <input className={campo} maxLength={MAX_TEXTO_CONDOMINIO} value={value.regrasCondominio} onChange={(e) => onChange({ ...value, regrasCondominio: e.target.value })} />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Observação (opcional)
        <input
          className={campo}
          data-testid="pets-observacao"
          maxLength={MAX_OBSERVACAO_PET}
          placeholder="Ex.: gatos castrados; nada de animais no sofá."
          value={value.observacao}
          onChange={(e) => onChange({ ...value, observacao: e.target.value })}
        />
        <span className="text-xs font-normal text-muted" data-testid="pets-observacao-conta">
          {value.observacao.length}/{MAX_OBSERVACAO_PET}
        </span>
      </label>
    </div>
  );
}
