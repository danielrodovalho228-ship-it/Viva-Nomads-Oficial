"use client";

import { useState, useTransition } from "react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { CampoReais } from "@/components/ui/campo-reais";
import { proporAlteracao } from "@/lib/data/estadia-actions";
import { HREF_ESTADIA, ddmmaaaa } from "@/lib/estadia/estadia";
import type { PreviaRenovacao } from "@/lib/estadia/renovacao";
import { formatBRL } from "@/lib/utils";

const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

export function AlteracaoTela({
  contratoId,
  atual,
  entradaAberta,
  temFuturo,
  renovacao,
}: {
  contratoId: string;
  atual: { inicio: string | null; meses: number; ocupantes: number; valorMensal: number; capacidade: number };
  entradaAberta: boolean;
  temFuturo: boolean;
  /** E222-B: renovação = o mesmo aditivo, já preenchido como prorrogação; só a duração muda (dentro do teto). */
  renovacao?: { opcoes: number[]; sugeridos: number; previas: Record<number, PreviaRenovacao> };
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [inicio, setInicio] = useState(atual.inicio ?? "");
  const [meses, setMeses] = useState(renovacao?.sugeridos ?? atual.meses);
  const [ocupantes, setOcupantes] = useState(atual.ocupantes);
  const [valor, setValor] = useState<number | null>(atual.valorMensal);

  const enviar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await proporAlteracao(
        contratoId,
        renovacao
          ? { inicio: null, meses, ocupantes: null, valorMensal: null }
          : {
              inicio: entradaAberta && inicio !== atual.inicio ? inicio : null,
              meses: meses !== atual.meses ? meses : null,
              ocupantes: temFuturo && ocupantes !== atual.ocupantes ? ocupantes : null,
              valorMensal: temFuturo && valor != null && valor !== atual.valorMensal ? valor : null,
            },
      );
      if (!r.ok) setErro(r.erro);
      // Navegação completa: um router.push depois da ação pode ser descartado pelas ações e prefetches que o painel
      // dispara ao mesmo tempo (t256), e a proposta enviada deixaria a pessoa parada no formulário.
      else window.location.assign(HREF_ESTADIA(contratoId));
    });

  if (renovacao) {
    const previa = renovacao.previas[meses];
    return (
      <Panel title="Renovação" data-testid="alteracao-form" data-modo="renovar">
        <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
          Meses de contrato (hoje {atual.meses})
          <select className={campo} value={meses} onChange={(e) => setMeses(Number(e.target.value))} data-testid="alteracao-meses">
            {renovacao.opcoes.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mês" : "meses"} (mais {m - atual.meses})
              </option>
            ))}
          </select>
        </label>
        {previa && (
          <p className="mt-3 text-sm text-ink" data-testid="renovacao-previa" data-inicio={previa.inicio} data-fim={previa.fim} data-valor={previa.valor}>
            Mais {previa.meses} {previa.meses === 1 ? "mês" : "meses"}: de {ddmmaaaa(previa.inicio)} a {ddmmaaaa(previa.fim)} · {formatBRL(previa.valor)} no período acrescentado.
          </p>
        )}
        <Button className="mt-4" variant="primary" disabled={pendente} onClick={enviar} data-testid="alteracao-enviar">
          Enviar a renovação
        </Button>
        <p className="mt-2 text-xs text-muted">A outra parte tem 7 dias para aceitar ou recusar. Depois do aceite, as duas partes assinam o aditivo com código.</p>
        {erro && (
          <p role="alert" className="mt-2 text-sm font-semibold text-red-700" data-testid="estadia-erro">
            {erro}
          </p>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="O que muda" data-testid="alteracao-form">
      <div className="grid gap-4 sm:grid-cols-2">
        {entradaAberta && (
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Data de entrada
            <CampoData value={inicio} onChange={(e) => setInicio(e.target.value)} data-testid="alteracao-inicio" />
          </label>
        )}
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Meses de contrato
          <select className={campo} value={meses} onChange={(e) => setMeses(Number(e.target.value))} data-testid="alteracao-meses">
            {[1, 2, 3, 4, 5, 6].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mês" : "meses"}
              </option>
            ))}
          </select>
        </label>
        {temFuturo && (
          <>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Ocupantes
              <select className={campo} value={ocupantes} onChange={(e) => setOcupantes(Number(e.target.value))} data-testid="alteracao-ocupantes">
                {Array.from({ length: Math.max(1, atual.capacidade) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Valor mensal
              <CampoReais value={valor} onChange={setValor} centavos testid="alteracao-valor" />
            </label>
          </>
        )}
      </div>
      <Button className="mt-4" variant="primary" disabled={pendente} onClick={enviar} data-testid="alteracao-enviar">
        Enviar proposta
      </Button>
      <p className="mt-2 text-xs text-muted">A outra parte tem 7 dias para aceitar ou recusar.</p>
      {erro && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700" data-testid="estadia-erro">
          {erro}
        </p>
      )}
    </Panel>
  );
}
