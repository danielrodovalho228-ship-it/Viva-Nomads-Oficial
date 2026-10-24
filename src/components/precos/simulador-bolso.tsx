"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useState } from "react";
import Link from "next/link";
import { blocosBolso, calcularBolso, NOTA_BOLSO } from "@/lib/cobranca/bolso";
import { formatBRL, cn } from "@/lib/utils";
import { SUPORTE_EMAIL } from "@/lib/site";

/**
 * "O que vai para o seu bolso" (ordem 6696611c, tela 10). A conta sai de calcularBolso → comissaoSobreContrato.
 * Em /precos o dono digita tudo; no cadastro do anúncio `valorMensal` e `meses` vêm do passo de preço.
 */
export function SimuladorBolso(p: {
  valorMensal?: number;
  mesesIniciais?: number;
  compacto?: boolean;
  className?: string;
}) {
  const doCadastro = p.valorMensal !== undefined;
  const [valorDigitado, setValorDigitado] = useState(3000);
  const [meses, setMeses] = useState(String(p.mesesIniciais ?? 4));
  const [imoveis, setImoveis] = useState("1");
  const valor = doCadastro ? p.valorMensal! : valorDigitado;
  const b = calcularBolso(valor, Number(meses), Number(imoveis));

  return (
    <section
      id={p.compacto ? undefined : "simulador"}
      className={cn("rounded-xl border border-line bg-white p-4 sm:p-8", p.className)}
      data-testid="simulador-bolso"
      aria-labelledby="bolso-titulo"
    >
      <h2 id="bolso-titulo" className="font-title text-xl font-semibold text-ink sm:text-2xl">
        O que vai para o seu bolso
      </h2>
      <div className={cn("mt-4 grid gap-3", doCadastro ? "grid-cols-2" : "sm:grid-cols-3")}>
        {!doCadastro && (
          <label className="text-sm font-medium text-ink">
            Valor mensal (R$)
            <CampoReais
              semPrefixo
              className="input mt-1 w-full"
              value={valorDigitado}
              onChange={(v) => setValorDigitado(v ?? 0)}
              testid="bolso-valor"
            />
          </label>
        )}
        <label className="text-sm font-medium text-ink">
          Meses de contrato
          <input
            className="input mt-1 w-full"
            inputMode="numeric"
            value={meses}
            onChange={(e) => setMeses(e.target.value.replace(/\D/g, ""))}
            data-testid="bolso-meses"
          />
        </label>
        <label className="text-sm font-medium text-ink">
          Imóveis seus na Viva
          <input
            className="input mt-1 w-full"
            inputMode="numeric"
            value={imoveis}
            onChange={(e) => setImoveis(e.target.value.replace(/\D/g, ""))}
            data-testid="bolso-imoveis"
          />
        </label>
      </div>

      <div className="mt-4" aria-live="polite" data-testid="bolso-resultado" data-estado={b.estado}>
        {b.estado === "invalido" ? (
          <p className="text-sm text-muted">Informe valor mensal, meses e quantos imóveis você tem para ver a conta.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {b.estado === "gestor" ? (
              <>
                <Fato rotulo="Você recebe do morador" detalhe="integral e direto a você" testid="bolso-recebe" valor={formatBRL(b.recebe)} />
                <dl className="rounded-xl border border-line p-4 text-sm">
                  <dt className="text-ink">Taxa de serviço da Viva</dt>
                  <dd className="mt-1 font-semibold text-ink" data-testid="bolso-gestor">
                    Plano Gestor:{" "}
                    <Link href={`mailto:${SUPORTE_EMAIL}`} className="underline">
                      fale com a Viva
                    </Link>
                  </dd>
                </dl>
              </>
            ) : (
              (() => {
                // E51: dois fatos lado a lado, sem conta entre eles — a taxa é cobrada à parte, nunca descontada do que o
                // morador paga ao dono (a Viva só intermedia, não segura pagamentos).
                const [recebe, taxa] = blocosBolso(b, valor, Number(meses));
                return (
                  <>
                    <Fato {...recebe} testid="bolso-recebe" />
                    <Fato {...taxa} testid="bolso-taxa" />
                  </>
                );
              })()
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">{NOTA_BOLSO}</p>
    </section>
  );
}

/** Um fato num cartão próprio: rótulo, valor e a explicação embaixo. */
function Fato(p: { rotulo: string; valor: string; detalhe?: string | null; testid: string }) {
  return (
    <dl className="rounded-xl border border-line p-4 text-sm">
      <dt className="text-ink">{p.rotulo}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-ink" data-testid={p.testid}>
        {p.valor}
      </dd>
      {p.detalhe && (
        <dd className="mt-1 text-xs text-muted" data-testid={`${p.testid}-detalhe`}>
          {p.detalhe}
        </dd>
      )}
    </dl>
  );
}
