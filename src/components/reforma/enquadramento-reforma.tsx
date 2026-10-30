"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { CampoReais } from "@/components/ui/campo-reais";
import { TEXTO_AVISO, TEXTO_NAO_E_ORIENTACAO, enquadramento, linhasDoResultado } from "@/lib/reforma/enquadramento";
import { formatBRL } from "@/lib/utils";

export const ANCORA_ENQUADRAMENTO = "enquadramento-reforma";

/** E255 — o aviso (só nos limiares; quem decide é o servidor): leva à conferência, em Ganhos. */
export function AvisoReforma() {
  return (
    <Link
      href={`/dashboard/ganhos#${ANCORA_ENQUADRAMENTO}`}
      className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm text-ink hover:border-forest"
      data-testid="aviso-reforma"
    >
      <Scale className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
      <span>
        {TEXTO_AVISO} <span className="font-semibold text-forest underline">Conferir</span>
      </span>
    </Link>
  );
}

/**
 * E255 — "Você entra na regra nova?". Os números da Viva vêm do servidor (só do próprio dono). Os de fora da Viva ficam
 * SÓ neste navegador: não há formulário, nome de campo, gravação nem envio — a conta é feita aqui mesmo.
 */
export function EnquadramentoReforma(p: { ano: number; imoveisComContrato: number; receitaRegistrada: number; projecao: number }) {
  const [outrosImoveis, setOutrosImoveis] = useState("");
  const [outraReceita, setOutraReceita] = useState<number | null>(null);
  const receitaNaViva = p.receitaRegistrada + p.projecao;
  const r = enquadramento({
    imoveisNaViva: p.imoveisComContrato,
    receitaNaViva,
    outrosImoveis: Number(outrosImoveis.replace(/\D/g, "")) || 0,
    outraReceita,
  });
  const linhas = linhasDoResultado(r);
  return (
    <section id={ANCORA_ENQUADRAMENTO} className="mt-12 scroll-mt-24 rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="enquadramento-reforma" aria-labelledby="enquadramento-titulo">
      <h2 id="enquadramento-titulo" className="font-title text-xl font-semibold text-ink">
        Você entra na regra nova?
      </h2>
      <p className="mt-1 text-sm text-muted">
        Com a reforma tributária, a pessoa física com mais de 3 imóveis alugados e receita acima de R$ 240 mil no ano anterior passa a ter regras novas.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div data-testid="enquadramento-viva">
          <h3 className="text-sm font-semibold text-ink">Na Viva, em {p.ano}</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Imóveis com contrato no ano</dt>
              <dd className="font-semibold tabular-nums text-ink" data-testid="enq-imoveis-viva">{p.imoveisComContrato}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Receita registrada no ano</dt>
              <dd className="font-semibold tabular-nums text-ink" data-testid="enq-receita-viva">{formatBRL(p.receitaRegistrada)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Contratos assinados até 31/12</dt>
              <dd className="font-semibold tabular-nums text-ink" data-testid="enq-projecao-viva">{formatBRL(p.projecao)}</dd>
            </div>
          </dl>
        </div>

        <div data-testid="enquadramento-fora">
          <h3 className="text-sm font-semibold text-ink">Fora da Viva (opcional)</h3>
          <p className="mt-1 text-xs text-muted">Fica só neste aparelho: não é salvo nem enviado.</p>
          <label className="mt-3 block text-sm text-ink" htmlFor="enq-outros-imoveis">
            Outros imóveis alugados
          </label>
          <input
            id="enq-outros-imoveis"
            inputMode="numeric"
            autoComplete="off"
            value={outrosImoveis}
            onChange={(e) => setOutrosImoveis(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-forest focus:outline-none"
            data-testid="enq-outros-imoveis"
          />
          <label className="mt-3 block text-sm text-ink" htmlFor="enq-outra-receita">
            Outra receita de aluguel no ano
          </label>
          <CampoReais id="enq-outra-receita" value={outraReceita} onChange={setOutraReceita} testid="enq-outra-receita" />
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-surface-2 p-4 text-sm text-ink" data-testid="enquadramento-resultado" data-criterios={r.passaCriterios ? "passa" : "nao"} data-gatilho={r.passaGatilho ? "passa" : "nao"}>
        <p className="text-xs text-muted">
          Somando: {r.imoveis} {r.imoveis === 1 ? "imóvel" : "imóveis"} · {formatBRL(r.receita)} no ano
        </p>
        <p className="mt-2 font-semibold" data-testid="enq-linha-criterios">{linhas.criterios}</p>
        <p className="mt-2" data-testid="enq-linha-gatilho">{linhas.gatilho}</p>
      </div>
      <p className="mt-3 text-xs text-muted" data-testid="enq-nao-e-orientacao">
        {TEXTO_NAO_E_ORIENTACAO}
      </p>
    </section>
  );
}
