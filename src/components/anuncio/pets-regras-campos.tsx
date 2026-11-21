"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { CartaoEscolha, EscolhaUnica } from "@/components/anuncio/escolha-assistente";
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
  /** Ordem 75ce56db (D): exigências do dono na ficha do pet. */
  exigeCarteiraVacina: boolean;
  exigeFotoPet: boolean;
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
    exigeCarteiraVacina: r?.exigeCarteiraVacina === true,
    exigeFotoPet: r?.exigeFotoPet === true,
  };
}

// E193: o campo (texto, data, número) tem a moldura, o tamanho e o estado do cartão grande do assistente.
const campo = "w-full min-h-14 rounded-xl border-2 border-line bg-white px-4 text-sm text-ink outline-none transition-colors hover:border-sage focus:border-forest";

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
        {/* E193: várias escolhas = o cartão grande, em grade (antes, caixa quadrada dentro de pílula). */}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ESPECIES_PET.map((e) => (
            <CartaoEscolha key={e} papel="checkbox" on={value.especies.includes(e)} onClick={() => alternar(e)} rotulo={ROTULO_ESPECIE[e]} testid={`pets-especie-${e}`} />
          ))}
        </div>
        {value.especies.length === 0 && <p className="mt-1 text-xs text-muted">Sem nenhum marcado, vale qualquer animal.</p>}
      </fieldset>
      <EscolhaUnica<PortePet | "">
        testid="pets-porte"
        legenda="Porte máximo"
        valor={value.porteMax}
        onChange={(porteMax) => onChange({ ...value, porteMax })}
        opcoes={[{ valor: "", rotulo: "Sem limite de porte" }, ...PORTES_PET.map((p) => ({ valor: p, rotulo: ROTULO_PORTE[p] }))]}
      />
      <EscolhaUnica<string>
        testid="pets-qtd"
        legenda="Quantos animais, no máximo?"
        valor={value.qtdMax}
        onChange={(qtdMax) => onChange({ ...value, qtdMax })}
        opcoes={[{ valor: "", rotulo: "Sem limite" }, ...Array.from({ length: MAX_PETS }, (_, i) => i + 1).map((n) => ({ valor: String(n), rotulo: rotuloQtdPets(n) }))]}
      />
      <fieldset>
        <legend className="text-sm font-semibold text-ink">O que você exige na ficha do pet? (opcional)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <CartaoEscolha
            papel="checkbox"
            on={value.exigeCarteiraVacina}
            onClick={() => onChange({ ...value, exigeCarteiraVacina: !value.exigeCarteiraVacina })}
            rotulo="Carteira de vacinação em dia"
            testid="pets-exige-carteira"
          />
          <CartaoEscolha
            papel="checkbox"
            on={value.exigeFotoPet}
            onClick={() => onChange({ ...value, exigeFotoPet: !value.exigeFotoPet })}
            rotulo="Foto do pet"
            testid="pets-exige-foto"
          />
        </div>
        <p className="mt-1 text-xs text-muted">Você vê se a ficha cumpre antes de aceitar. Não impede o pedido.</p>
      </fieldset>
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
        <EscolhaUnica<TipoValorPet>
          testid="valor-pet-tipo"
          legenda="Esse valor é"
          colunas={1}
          valor={value.valorPetTipo}
          onChange={(valorPetTipo) => onChange({ ...value, valorPetTipo })}
          opcoes={TIPOS_VALOR_PET.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_VALOR_PET[t] }))}
        />
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
