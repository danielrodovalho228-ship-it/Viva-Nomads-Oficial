import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, Hourglass } from "lucide-react";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { getCarteiraDoDono } from "@/lib/data/carteira";
import { ganhosDoDono } from "@/lib/ganhos-dono";
import { dataBR, formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Ganhos — Viva Nomads" };

/**
 * E176 (D1): a subaba "Ganhos" de Contratos. O valor mensal de cada contrato em vigência ou a começar, somado. Mesma
 * fonte da Análise da carteira (getCarteiraDoDono, no servidor), sem a trava de 3 imóveis: aqui é o dinheiro do dono,
 * contrato a contrato. A Viva não recebe o valor mensal: ele vai direto do morador para o proprietário.
 */
export default async function GanhosPage() {
  const g = ganhosDoDono(isSupabaseConfigured() ? await getCarteiraDoDono() : []);
  return (
    <div data-testid="ganhos">
      <PageTitle title="Ganhos" subtitle="O valor mensal de cada contrato, em vigência e a começar." />
      {g.linhas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum contrato em vigência ainda"
          text="Quando um morador assinar e o 1º pagamento for registrado, o valor mensal do contrato aparece aqui."
          action={<ButtonLink href="/dashboard/imoveis" variant="secondary" size="sm">Ver meus anúncios</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div data-testid="ganhos-vigencia" data-valor={g.vigencia}>
              <StatCard label="Por mês, em vigência" value={formatBRL(g.vigencia)} icon={Wallet} />
            </div>
            <div data-testid="ganhos-a-comecar" data-valor={g.aComecar}>
              <StatCard label="Contratado a começar" value={formatBRL(g.aComecar)} icon={Hourglass} />
            </div>
          </div>
          <Panel title="Por contrato" className="mt-6">
            <ul className="divide-y divide-line" data-testid="ganhos-lista">
              {g.linhas.map((l) => (
                <li key={l.contratoId ?? l.propertyId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm" data-testid="ganhos-linha">
                  <span className="min-w-0">
                    {l.contratoId ? (
                      <Link href={`/dashboard/contratos/${l.contratoId}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                        {l.titulo}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{l.titulo}</span>
                    )}
                    <span className="block text-xs text-muted">
                      {l.situacao === "ocupado" ? "Em vigência" : "A começar"}
                      {l.inicio ? ` · de ${dataBR(l.inicio)}` : ""}
                      {l.fim ? ` até ${dataBR(l.fim)}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{formatBRL(l.valorMensal)}/mês</span>
                </li>
              ))}
            </ul>
          </Panel>
          <p className="mt-4 text-xs text-muted" data-testid="ganhos-nota">
            O valor mensal vai direto do morador para você. A Viva não recebe esse valor; a taxa de serviço é cobrada à parte.
          </p>
        </>
      )}
    </div>
  );
}
