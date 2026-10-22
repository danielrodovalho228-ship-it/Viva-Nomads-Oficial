"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { meusPapeis } from "@/lib/data/papeis-actions";
import { ROTULO_PAPEL, type PapelDaConta } from "@/lib/onboarding/ativacao";

/**
 * "Seus papéis" (Prompt 43, adendo da Conta): conta única, papéis em camadas derivados do que a pessoa tem. Morador
 * sempre; Proprietário com o primeiro imóvel ou rascunho; Parceiro com a solicitação enviada. Quem ainda não tem o papel
 * vê o convite ("Anunciar um imóvel", "Quero ser parceiro"). Não há troca de modo: o contexto da tela decide.
 */
export function SeusPapeis() {
  const [papeis, setPapeis] = useState<PapelDaConta[] | null>(null);
  useEffect(() => {
    let vivo = true;
    meusPapeis()
      .then((p) => vivo && setPapeis(p))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  if (!papeis) return null;
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="seus-papeis" aria-labelledby="seus-papeis-titulo">
      <h2 id="seus-papeis-titulo" className="font-title text-lg font-semibold text-ink">
        Seus papéis
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {papeis.map((p) => (
          <li key={p.papel} className="flex flex-wrap items-center justify-between gap-3 py-3" data-papel={p.papel} data-ativo={p.ativo ? "1" : "0"}>
            <span className="flex min-w-0 items-start gap-2">
              {p.ativo ? <Check className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <span className="mt-1 h-4 w-4 shrink-0" aria-hidden />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{ROTULO_PAPEL[p.papel]}</span>
                <span className="block text-sm text-muted">{p.estado}</span>
              </span>
            </span>
            {p.convite && (
              <Link href={p.convite.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
                {p.convite.rotulo}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
