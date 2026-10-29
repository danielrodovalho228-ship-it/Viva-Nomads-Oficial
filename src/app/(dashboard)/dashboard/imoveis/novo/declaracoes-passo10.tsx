"use client";

import { AlertTriangle, Info } from "lucide-react";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import {
  COMO_DESCOBRIR_CONVENCAO,
  OPCOES_CONVENCAO,
  PERGUNTA_CONVENCAO,
  TEXTO_HABITAVEL,
  TEXTO_IPTU,
  type DeclaracoesPasso10,
} from "@/lib/anuncio/requisitos-passo10";

/**
 * E132-A, Parte C, item 8: as declarações de um toque do cartão "Antes de publicar" (Passo 10). Sim/não e a convenção
 * (três respostas) no cartão da Qualificação (E193), só nos tipos em condomínio — casa e chácara contam como "Sim".
 */
export function DeclaracoesDoImovel({
  valor,
  onChange,
  emCondominio,
}: {
  valor: DeclaracoesPasso10;
  onChange: (d: DeclaracoesPasso10) => void;
  emCondominio: boolean;
}) {
  // E193: sim/não no cartão da Qualificação (antes, chave deslizante); continua um interruptor para o leitor de tela.
  const linha = (rotulo: string, ligado: boolean, mudar: (v: boolean) => void, testId: string) => (
    <CartaoEscolha papel="switch" on={ligado} onClick={() => mudar(!ligado)} rotulo={rotulo} testid={testId} aria-label={rotulo} />
  );
  return (
    <div className="space-y-2 rounded-xl border border-sage-200 p-4" data-testid="declaracoes-passo10">
      <p className="text-sm font-medium text-ink">Declarações do imóvel</p>
      {linha(TEXTO_IPTU, valor.iptuOk, (v) => onChange({ ...valor, iptuOk: v }), "declaracao-iptu")}
      {linha(TEXTO_HABITAVEL, valor.habitavel, (v) => onChange({ ...valor, habitavel: v }), "declaracao-habitavel")}
      {emCondominio && (
        <fieldset className="pt-2" data-testid="declaracao-convencao">
          <legend className="text-sm font-medium text-ink">{PERGUNTA_CONVENCAO}</legend>
          <details className="mt-1">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-forest">
              <Info className="h-4 w-4" aria-hidden /> Como descobrir?
            </summary>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{COMO_DESCOBRIR_CONVENCAO}</p>
          </details>
          {/* E193: escolha única no cartão da Qualificação (antes, pílulas). */}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={PERGUNTA_CONVENCAO}>
            {OPCOES_CONVENCAO.map((o) => (
              <CartaoEscolha key={o.valor} on={valor.convencao === o.valor} onClick={() => onChange({ ...valor, convencao: o.valor })} rotulo={o.rotulo} testid={`convencao-${o.valor}`} />
            ))}
          </div>
          {valor.convencao === "unknown" && (
            <p className="mt-2 text-sm text-muted" data-testid="convencao-pendencia">
              Publica com pendência: confirme com o síndico assim que puder.
            </p>
          )}
          {valor.convencao === "no" && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="convencao-bloqueia">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              Se a convenção proíbe estadias de 30 a 180 dias, o imóvel não pode ser anunciado.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
