"use client";

import {
  ESPECIES_PET,
  PORTES_PET,
  MAX_PETS,
  MAX_TEXTO_CONDOMINIO,
  TIPOS_VALOR_PET,
  ROTULO_TIPO_VALOR_PET,
  ROTULO_ESPECIE,
  ROTULO_PORTE,
  type EspeciePet,
  type PortePet,
  type RegrasPets,
  type TipoValorPet,
} from "@/lib/anuncio/pets-regras";

/** Rascunho do formulário: tudo em texto até o servidor validar. */
export interface RegrasPetsForm {
  especies: EspeciePet[];
  porteMax: PortePet;
  qtdMax: string;
  reforcoCaucao: string;
  regrasCondominio: string;
  valorPet: string;
  valorPetTipo: TipoValorPet;
}

export function formDeRegras(r?: RegrasPets): RegrasPetsForm {
  return {
    especies: r?.especies ?? ["cao", "gato"],
    porteMax: r?.porteMax ?? "M",
    qtdMax: String(r?.qtdMax ?? 1),
    reforcoCaucao: r && r.reforcoCaucao > 0 ? String(r.reforcoCaucao) : "",
    regrasCondominio: r?.regrasCondominio ?? "",
    valorPet: r?.valorPet && r.valorPet > 0 ? String(r.valorPet) : "",
    valorPetTipo: r?.valorPetTipo ?? "reembolsavel",
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
        {value.especies.length === 0 && <p className="mt-1 text-xs text-red-700">Marque ao menos um tipo de animal.</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Porte máximo
          <select className={campo} value={value.porteMax} onChange={(e) => onChange({ ...value, porteMax: e.target.value as PortePet })}>
            {PORTES_PET.map((p) => (
              <option key={p} value={p}>{ROTULO_PORTE[p]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Quantos animais, no máximo?
          <select className={campo} value={value.qtdMax} onChange={(e) => onChange({ ...value, qtdMax: e.target.value })}>
            {Array.from({ length: MAX_PETS }, (_, i) => String(i + 1)).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Reforço de Caução por causa do pet (R$, opcional)
        <input className={campo} inputMode="decimal" placeholder="0" value={value.reforcoCaucao} onChange={(e) => onChange({ ...value, reforcoCaucao: e.target.value.replace(",", ".") })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2" data-testid="valor-pet-campos">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Valor pet (R$, opcional)
          <input
            className={campo}
            inputMode="decimal"
            placeholder="0"
            data-testid="valor-pet"
            value={value.valorPet}
            onChange={(e) => onChange({ ...value, valorPet: e.target.value.replace(",", ".") })}
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
    </div>
  );
}
