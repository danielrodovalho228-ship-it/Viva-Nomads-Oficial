import Link from "next/link";
import { Bell, Wrench } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { NotificationsPanel } from "@/components/account/conta-secoes";
import { avisosRecentes } from "@/lib/data/manutencao-actions";
import { dataHoraBrasilia } from "@/config/atendimento";
import { listarPropostas } from "@/lib/data/propostas-actions";
import { textoVencimento } from "@/lib/propostas/regras";

/**
 * Notificações (critério 5): as atualizações recentes das ordens de manutenção
 * (dos dois lados) e as preferências — LIGADAS por padrão; só desliga quem
 * desligar aqui.
 */
export default async function NotificacoesPage() {
  const [r, todas] = await Promise.all([avisosRecentes(), listarPropostas().catch(() => [])]);
  const avisos = r?.avisos ?? [];
  // Propostas esperando a SUA resposta (prompt 27, item 7): o aviso no site, junto do push e do e-mail.
  const propostas = todas.filter((p) => p.aguardandoVoce);
  const agora = new Date();
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

      {propostas.length > 0 && (
        <Panel title="Propostas para responder" className="mb-6" data-testid="avisos-propostas">
          <ul className="divide-y divide-sage-100">
            {propostas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm" data-testid="aviso-proposta">
                <span className="min-w-0">
                  <span className="block text-ink">
                    {p.papel === "tenant" ? "Você recebeu uma proposta" : "Contraproposta para responder"} — {textoVencimento(p.validaAte, agora)}
                  </span>
                  <span className="block text-xs text-muted">
                    {p.numero} · {p.imovel}
                  </span>
                </span>
                <Link href={`/dashboard/propostas/${p.id}`} className="shrink-0 text-xs font-medium text-forest underline">
                  Responder
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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
