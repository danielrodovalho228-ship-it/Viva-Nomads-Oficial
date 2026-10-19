"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useState } from "react";
import Link from "next/link";
import { calcularBolso, NOTA_BOLSO } from "@/lib/cobranca/bolso";
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
  const [meses, setMeses] = useState(String(p.mesesIniciais ?? 6));
  const [imoveis, setImoveis] = useState("1");
  const valor = doCadastro ? p.valorMensal! : valorDigitado;
  const b = calcularBolso(valor, Number(meses), Number(imoveis));

  return (
    <section
      id={p.compacto ? undefined : "simulador"}
      className={cn("rounded-2xl border border-line bg-white p-5 sm:p-8", p.className)}
      data-testid="simulador-bolso"
      aria-labelledby="bolso-titulo"
    >
      <h2 id="bolso-titulo" className="font-title text-xl font-bold text-ink sm:text-2xl">
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

      <div className="mt-5" aria-live="polite" data-testid="bolso-resultado" data-estado={b.estado}>
        {b.estado === "invalido" ? (
          <p className="text-sm text-muted">Informe valor mensal, meses e quantos imóveis você tem para ver a conta.</p>
        ) : (
          <dl className="divide-y divide-line rounded-xl border border-line">
            <Linha rotulo="Você recebe do morador" testid="bolso-recebe" valor={formatBRL(b.recebe)} />
            {b.estado === "gestor" ? (
              <div className="flex items-center justify-between gap-3 p-3 text-sm sm:p-4">
                <dt className="text-ink">Taxa Viva</dt>
                <dd className="text-right font-semibold text-ink" data-testid="bolso-gestor">
                  Plano Gestor:{" "}
                  <Link href={`mailto:${SUPORTE_EMAIL}`} className="underline">
                    fale com a Viva
                  </Link>
                </dd>
              </div>
            ) : (
              <>
                <Linha rotulo={`Taxa Viva (${b.taxaTexto} do total)`} testid="bolso-taxa" valor={`− ${formatBRL(b.valorTaxa)}`} />
                <Linha rotulo="Fica com você" testid="bolso-fica" valor={formatBRL(b.fica)} destaque />
              </>
            )}
          </dl>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">{NOTA_BOLSO}</p>
    </section>
  );
}

function Linha(p: { rotulo: string; valor: string; testid: string; destaque?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 p-3 text-sm sm:p-4", p.destaque && "bg-surface-2")}>
      <dt className="text-ink">{p.rotulo}</dt>
      <dd className={cn("text-right tabular-nums", p.destaque ? "text-lg font-bold text-ink" : "font-semibold text-ink")} data-testid={p.testid}>
        {p.valor}
      </dd>
    </div>
  );
}
