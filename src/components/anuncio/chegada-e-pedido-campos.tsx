"use client";

import { CartaoEscolha, Pilula } from "@/components/anuncio/escolha-assistente";
import {
  AJUDA_TIPO_ENTRADA,
  CONSIDERAR_OPCOES,
  LIMITE_CONSIDERAR_TEXTO,
  LIMITE_MENSAGEM_PEDIDO,
  TIPOS_ENTRADA,
  mostraClasseDeRuido,
  type ChegadaEPedido,
} from "@/lib/anuncio/chegada-e-pedido";

/** Rascunho do formulário (61-B): tipo de entrada, mensagem para quem pede e o que considerar antes de pedir. */
export interface ChegadaEPedidoForm {
  tipoEntrada: string;
  mensagemParaPedido: string;
  considerarAntes: string[];
  considerarAntesTexto: string;
}

export function formDeChegada(c?: ChegadaEPedido): ChegadaEPedidoForm {
  return {
    tipoEntrada: c?.tipoEntrada ?? "",
    mensagemParaPedido: c?.mensagemParaPedido ?? "",
    considerarAntes: c?.considerarAntes ?? [],
    considerarAntesTexto: c?.considerarAntesTexto ?? "",
  };
}

/**
 * O que vai ao servidor (PropertyInput e rascunho). Tipo de entrada vazio não vai (undefined = não mexe): um rascunho
 * antigo sem o campo no JSON nunca apaga o tipo já gravado no imóvel. O campo é obrigatório, então não há "limpar".
 */
export function payloadDaChegada(f: ChegadaEPedidoForm) {
  return {
    tipoEntrada: f.tipoEntrada || undefined,
    mensagemParaPedido: f.mensagemParaPedido,
    considerarAntes: f.considerarAntes,
    considerarAntesTexto: f.considerarAntesTexto,
  };
}

const area = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";

export function ChegadaEPedidoCampos({
  value,
  onChange,
  erroTipoEntrada,
}: {
  value: ChegadaEPedidoForm;
  onChange: (v: ChegadaEPedidoForm) => void;
  erroTipoEntrada?: string;
}) {
  const alternar = (k: string) =>
    onChange({
      ...value,
      considerarAntes: value.considerarAntes.includes(k) ? value.considerarAntes.filter((x) => x !== k) : [...value.considerarAntes, k],
    });
  return (
    <div className="mt-4 grid gap-4" data-testid="chegada-e-pedido">
      <fieldset id="campo-tipo-entrada" aria-invalid={erroTipoEntrada ? true : undefined}>
        <legend className="text-sm font-semibold text-ink">Como se entra no imóvel?</legend>
        <p className="mt-1 text-xs text-ink-soft">{AJUDA_TIPO_ENTRADA}</p>
        {/* E193: escolha única em cartões, o padrão da Qualificação (antes, botões redondos de rádio). */}
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Como se entra no imóvel?">
          {TIPOS_ENTRADA.map((t) => (
            <CartaoEscolha
              key={t.chave}
              on={value.tipoEntrada === t.chave}
              onClick={() => onChange({ ...value, tipoEntrada: t.chave })}
              rotulo={t.rotulo}
              testid={`tipo-entrada-${t.chave}`}
            />
          ))}
        </div>
        {erroTipoEntrada && (
          <p className="mt-1 text-xs font-medium text-red-700" role="alert">
            {erroTipoEntrada}
          </p>
        )}
      </fieldset>

      <label className="grid gap-1 text-sm font-semibold text-ink">
        Mensagem para quem vai pedir (opcional)
        <span className="text-xs font-normal text-ink-soft">Aparece antes do pedido. Telefone, e-mail e links de contato são escondidos.</span>
        <textarea
          className={area}
          rows={3}
          maxLength={LIMITE_MENSAGEM_PEDIDO}
          value={value.mensagemParaPedido}
          onChange={(e) => onChange({ ...value, mensagemParaPedido: e.target.value })}
          placeholder="Ex.: prefiro estadias de 3 meses ou mais; o prédio pede cadastro de quem entra."
          data-testid="mensagem-para-pedido"
        />
        <span className="text-right text-xs font-normal text-ink-soft">
          {value.mensagemParaPedido.length}/{LIMITE_MENSAGEM_PEDIDO}
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">O que considerar antes de pedir (opcional)</legend>
        <p className="mt-1 text-xs text-ink-soft">Dizer antes evita surpresa e conta a favor do anúncio na busca.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* E193: várias escolhas = pílulas, sem a caixa quadrada dentro. */}
          {CONSIDERAR_OPCOES.map((o) => (
            <Pilula key={o.chave} on={value.considerarAntes.includes(o.chave)} onClick={() => alternar(o.chave)} testid={`considerar-${o.chave}`}>
              {o.rotulo}
            </Pilula>
          ))}
        </div>
        {mostraClasseDeRuido(value.considerarAntes) && (
          <p className="mt-2 text-xs text-ink-soft">O nível de ruído que você declarou em Conforto aparece junto, no anúncio.</p>
        )}
        <textarea
          className={`${area} mt-2`}
          rows={2}
          maxLength={LIMITE_CONSIDERAR_TEXTO}
          aria-label="Detalhe o que considerar"
          value={value.considerarAntesTexto}
          onChange={(e) => onChange({ ...value, considerarAntesTexto: e.target.value })}
          placeholder="Ex.: rua com bares às sextas; 3º andar sem elevador."
          data-testid="considerar-texto"
        />
      </fieldset>
    </div>
  );
}

/** O que o rascunho do assistente guardou (JSON): só o que tem a forma certa. Campo ausente mantém o valor atual. */
export function formDeRascunho(d: Record<string, unknown>, atual: ChegadaEPedidoForm = formDeChegada()): ChegadaEPedidoForm {
  const txt = (v: unknown, padrao: string) => (typeof v === "string" ? v : padrao);
  return {
    tipoEntrada: txt(d.tipoEntrada, atual.tipoEntrada),
    mensagemParaPedido: txt(d.mensagemParaPedido, atual.mensagemParaPedido),
    considerarAntes: Array.isArray(d.considerarAntes) ? d.considerarAntes.filter((x): x is string => typeof x === "string") : atual.considerarAntes,
    considerarAntesTexto: txt(d.considerarAntesTexto, atual.considerarAntesTexto),
  };
}
