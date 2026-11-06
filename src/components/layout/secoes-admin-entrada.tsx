"use client";

import Link from "next/link";
import type { ItemMenu } from "@/config/menu-por-papel";

/**
 * E349: ao entrar no painel admin pelo celular (/admin, Visão geral) as seções ficam À VISTA — o dono não precisa caçar o
 * menu atrás do botão de três linhas. É o MESMO menu do E176 (uma fonte só: a barra do admin, `barraAdminPara`), apenas aberto
 * na entrada, numa barra ao pé do "Voltar ao site" — com uma prévia das áreas —, que abre com UM toque e lista todas (aberta por
 * padrão empurrava a Visão geral 1.100 px para baixo, medido a 390 px); o botão do topo continua abrindo a gaveta nas outras telas.
 * Só no celular (no computador a barra lateral já está aberta).
 */
export function SecoesAdminEntrada({ itens }: { itens: readonly ItemMenu[] }) {
  const grupos = itens.filter((i) => i.filhos?.length);
  const soltos = itens.filter((i) => i.href && i.href !== "/admin");
  const previa = [...soltos, ...grupos.flatMap((g) => g.filhos ?? [])].map((i) => i.rotulo).slice(0, 6).join(" · ") + " …";
  return (
    <details className="web-only mb-4 rounded-xl border border-line bg-white lg:hidden print:hidden" data-testid="admin-secoes-entrada">
      <summary className="flex min-h-14 cursor-pointer flex-col justify-center px-4 py-2" data-testid="admin-secoes-resumo">
        <span className="text-sm font-semibold text-ink">Seções do painel · toque para ver todas</span>
        <span className="truncate text-xs text-muted">{previa}</span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-3">
        {soltos.length > 0 && (
          <ul className="grid grid-cols-2 gap-2">
            {soltos.map((i) => (
              <li key={i.id}>
                <Link href={i.href!} className="flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-medium text-forest" data-testid={`admin-secao-${i.id}`}>
                  {i.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {grupos.map((g) => (
          <section key={g.id} aria-label={g.rotulo}>
            <h2 className="mb-1 text-xs font-semibold text-muted">{g.rotulo}</h2>
            <ul className="grid grid-cols-2 gap-2">
              {g.filhos!.filter((f) => f.href).map((f) => (
                <li key={f.id}>
                  <Link href={f.href!} className="flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-medium text-forest" data-testid={`admin-secao-${f.id}`}>
                    {f.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
