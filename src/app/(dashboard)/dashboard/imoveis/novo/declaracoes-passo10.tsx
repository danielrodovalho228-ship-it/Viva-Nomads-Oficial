"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  COMO_DESCOBRIR_CONVENCAO,
  OPCOES_CONVENCAO,
  PERGUNTA_CONVENCAO,
  TEXTO_HABITAVEL,
  TEXTO_IPTU,
  type DeclaracoesPasso10,
} from "@/lib/anuncio/requisitos-passo10";

/**
 * E132-A, Parte C, item 8: as declarações de um toque do cartão "Antes de publicar" (Passo 10). Sim/não no padrão
 * toggle do E56; a convenção (três respostas) em pílulas, só nos tipos em condomínio — casa e chácara contam como "Sim".
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
  const linha = (rotulo: string, ligado: boolean, mudar: (v: boolean) => void, testId: string) => (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm font-medium text-ink">{rotulo}</span>
      <Switch checked={ligado} onChange={mudar} label={rotulo} testId={testId} />
    </div>
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
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={PERGUNTA_CONVENCAO}>
            {OPCOES_CONVENCAO.map((o) => (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={valor.convencao === o.valor}
                onClick={() => onChange({ ...valor, convencao: o.valor })}
                data-testid={`convencao-${o.valor}`}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                  valor.convencao === o.valor ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:border-sage"
                )}
              >
                {o.rotulo}
              </button>
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
