import Link from "next/link";
import { Bell, Wrench } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { NotificationsPanel } from "@/components/account/conta-secoes";
import { avisosRecentes } from "@/lib/data/manutencao-actions";
import { dataHoraBrasilia } from "@/config/atendimento";

/**
 * Notificações (critério 5): as atualizações recentes das ordens de manutenção
 * (dos dois lados) e as preferências — LIGADAS por padrão; só desliga quem
 * desligar aqui.
 */
export default async function NotificacoesPage() {
  const r = await avisosRecentes();
  const avisos = r?.avisos ?? [];
  return (
    <>
      <PageTitle capa="notificacoes"
        title="Notificações"
        subtitle="Avisos de manutenção, interessados, mensagens e pedidos. Tudo ligado por padrão."
      />

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4">
        <StatCard label="Manutenções em aberto" value={r?.abertas ?? 0} icon={Wrench} />
        <StatCard label="Atualizações recentes" value={avisos.length} icon={Bell} />
      </div>

      <Panel title="Atualizações de manutenção" data-testid="avisos-manutencao">
        {avisos.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma atualização por enquanto. As ordens de manutenção ficam em{" "}
            <Link href="/dashboard/solicitacoes" className="font-medium text-forest underline">
              Solicitações
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-sage-100">
            {avisos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block text-ink">{a.texto}</span>
                  <span className="block text-xs text-muted">
                    {a.imovel} · {dataHoraBrasilia(new Date(a.criadoEm))}
                  </span>
                </span>
                <Link href="/dashboard/solicitacoes" className="shrink-0 text-xs font-medium text-forest underline">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <NotificationsPanel />
    </>
  );
}
