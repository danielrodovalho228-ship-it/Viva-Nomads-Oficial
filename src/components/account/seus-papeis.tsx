"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { meusPapeis } from "@/lib/data/papeis-actions";
import { ROTULO_PAPEL, type PapelDaConta } from "@/lib/onboarding/ativacao";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useParceiroAprovado } from "@/lib/use-papel-barra";
import { papelDoModo } from "@/lib/papel/papel-ativo";
import { EVENTO_PAPEL, useTrocaPapel } from "@/components/papel/use-troca-papel";

/**
 * "Papéis e intenção" (Prompt 43, adendo da Conta; PAPEL-B): conta única, papéis em camadas derivados do que a pessoa
 * tem. Morador sempre; Proprietário com o primeiro imóvel ou rascunho; Parceiro com a parceria aprovada. Cada papel que
 * a pessoa tem traz "Usar este" (a MESMA troca do selo do topo; o papel em uso fica marcado). Quem ainda não tem o papel
 * vê o convite ("Anunciar um imóvel", "Quero ser parceiro"). Só muda o menu e o painel que aparecem primeiro.
 */
/**
 * `dentroDoBloco`: na Conta do site o bloco "Papéis e intenção" já é a região com o título — aqui vira um cartão simples,
 * sem segunda região nem segundo título iguais aninhados (CONTA-A, C3e). No app, segue com o próprio título.
 */
export function SeusPapeis({ dentroDoBloco = false }: { dentroDoBloco?: boolean } = {}) {
  const [papeis, setPapeis] = useState<PapelDaConta[] | null>(null);
  const { papeis: podeUsar, trocando, erro, trocar } = useTrocaPapel();
  const admin = useAuthStore((s) => s.user?.role === "admin");
  const parceiroAtivo = useAuthStore((s) => s.parceiroAtivo);
  const { mode } = useViewMode();
  const aprovado = useParceiroAprovado();
  const emUso = parceiroAtivo && aprovado ? "parceiro" : papelDoModo(mode === "owner" ? "owner" : "tenant");
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      meusPapeis()
        .then((p) => vivo && setPapeis(p))
        .catch(() => {});
    ler();
    window.addEventListener(EVENTO_PAPEL, ler);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_PAPEL, ler);
    };
  }, []);
  // C6: até os papéis chegarem, o cartão já ocupa o lugar (sem texto de carregando e sem a tela pular).
  if (!papeis)
    return (
      <div className="min-h-40 rounded-xl border border-line bg-white p-4" data-testid="seus-papeis-carregando" aria-busy="true">
        <span className="block h-4 w-2/3 rounded-lg bg-surface-2" aria-hidden />
        <span className="mt-4 block h-10 rounded-lg bg-surface-2" aria-hidden />
        <span className="mt-3 block h-10 rounded-lg bg-surface-2" aria-hidden />
      </div>
    );
  return (
    <Casca dentroDoBloco={dentroDoBloco}>
      {!dentroDoBloco && (
        <h2 id="seus-papeis-titulo" className="font-title text-lg font-semibold text-ink">
          Papéis e intenção
        </h2>
      )}
      <p className={dentroDoBloco ? "text-sm text-muted" : "mt-1 text-sm text-muted"}>O papel em uso decide o menu e o painel que aparecem primeiro. Não muda o que você pode fazer na conta.</p>
      <ul className="mt-2 divide-y divide-line">
        {papeis.map((p) => (
          <li
            key={p.papel}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
            data-papel={p.papel}
            data-ativo={p.ativo ? "1" : "0"}
            data-em-uso={!admin && emUso === p.papel ? "1" : "0"}
          >
            <span className="flex min-w-0 items-start gap-2">
              {p.ativo ? <Check className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <span className="mt-1 h-4 w-4 shrink-0" aria-hidden />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{ROTULO_PAPEL[p.papel]}</span>
                <span className="block text-sm text-muted">{p.estado}</span>
              </span>
            </span>
            {!admin && podeUsar?.includes(p.papel) &&
              (emUso === p.papel ? (
                <span className="inline-flex min-h-11 items-center text-sm font-semibold text-forest" data-testid={`papel-em-uso-${p.papel}`}>
                  Em uso
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!!trocando}
                  onClick={() => void trocar(p.papel)}
                  data-testid={`usar-papel-${p.papel}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest disabled:text-muted"
                >
                  Usar este
                </button>
              ))}
            {p.convite && (
              <Link href={p.convite.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
                {p.convite.rotulo}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {erro}
        </p>
      )}
    </Casca>
  );
}

function Casca({ dentroDoBloco, children }: { dentroDoBloco: boolean; children: React.ReactNode }) {
  const cls = "rounded-xl border border-line bg-white p-4";
  if (dentroDoBloco)
    return (
      <div className={cls} data-testid="seus-papeis">
        {children}
      </div>
    );
  return (
    <section className={cls} data-testid="seus-papeis" aria-labelledby="seus-papeis-titulo">
      {children}
    </section>
  );
}
