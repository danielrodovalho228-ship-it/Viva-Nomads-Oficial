"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { meusDegraus } from "@/lib/data/papeis-actions";
import type { Degrau } from "@/lib/onboarding/degraus";
import { PERFIL_ATUALIZADO } from "@/components/account/foto-perfil";

/** Perfil em 4 degraus (Prompt 43): lista com o estado de cada um, sem barra de progresso. */
export function DegrausPerfil() {
  const [degraus, setDegraus] = useState<Degrau[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      meusDegraus()
        .then((d) => vivo && setDegraus(d))
        .catch(() => {});
    ler();
    // CONTA-A, item 5: o progresso anda — nome, foto ou telefone salvos refazem a lista na hora.
    window.addEventListener(PERFIL_ATUALIZADO, ler);
    return () => {
      vivo = false;
      window.removeEventListener(PERFIL_ATUALIZADO, ler);
    };
  }, []);
  if (!degraus) return null;
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="degraus-perfil" aria-labelledby="degraus-titulo">
      <h2 id="degraus-titulo" className="font-title text-lg font-semibold text-ink">
        Quando cada dado é pedido
      </h2>
      <p className="text-sm text-muted">Cada dado é pedido só quando for usado.</p>
      <ol className="mt-2 divide-y divide-line">
        {degraus.map((d) => (
          <li
            key={d.id}
            // E67c: o estado ("Feito") fica numa coluna só, alinhado no mesmo ponto em todas as linhas.
            className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_9rem]"
            data-degrau={d.id}
            data-feito={d.feito ? "1" : "0"}
          >
            <span className="flex min-w-0 items-start gap-2">
              {d.feito ? <Check className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <Circle className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{d.titulo}</span>
                <span className="block text-sm text-muted">{d.paraQue}</span>
              </span>
            </span>
            <span className="flex flex-col items-start">
              <span className="text-sm text-ink" data-testid="degrau-estado">
                {d.estado}
              </span>
              {d.acao && (
                <Link href={d.acao.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
                  {d.acao.rotulo}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
