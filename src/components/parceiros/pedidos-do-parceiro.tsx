import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Panel, EmptyState } from "@/components/dashboard/primitives";
import { VazioOnboardingBloco } from "@/components/onboarding/vazio-onboarding";
import { VAZIOS_ONBOARDING } from "@/lib/onboarding/vazios";
import { pedidosDoMeuParceiro } from "@/lib/parceiros/pedido-actions";
import { proximoPasso, ROTULO_REGISTRO_SEM_DINHEIRO, rotuloStatus } from "@/lib/parceiros/pedido";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { dataHoraBRT, diaBRT } from "@/lib/datas-brasilia";
import { CalendarioMes, LegendaCalendario } from "@/components/calendario/calendario-mes";
import { mesesAPartirDe, type MarcaDia } from "@/lib/calendario/grade";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const FECHADOS = ["aceito", "agendado", "em_execucao", "entregue", "concluido"];
const NA_AGENDA = ["aceito", "agendado", "em_execucao"];

/**
 * "Pedidos" e "Ganhos" do painel do parceiro (Prompt 31b, item 7): novos primeiro, cada um com o estado e o próximo
 * passo (o orçamento e o aceite ficam dentro do pedido). Ganhos com a divisão 90/10 explícita e, enquanto o pagamento
 * pela plataforma estiver desligado, o rótulo "registro, sem dinheiro".
 */
export async function PedidosDoParceiro({ pagamentoAtivo }: { pagamentoAtivo: boolean }) {
  const pedidos = await pedidosDoMeuParceiro();
  const fechados = pedidos.filter((p) => FECHADOS.includes(p.status) && p.valor != null);
  const total = fechados.reduce((t, p) => t + Math.round((p.valor ?? 0) * 100), 0) / 100;
  const taxa = fechados.reduce((t, p) => t + Math.round((p.valorTaxa ?? 0) * 100), 0) / 100;
  const liquido = fechados.reduce((t, p) => t + Math.round((p.valorParceiro ?? 0) * 100), 0) / 100;
  // "Agenda" da barra do parceiro (Prompt 41): os horários já combinados, do mais próximo ao mais distante.
  const agenda = pedidos
    .filter((p) => p.horario && NA_AGENDA.includes(p.status))
    .sort((a, b) => String(a.horario).localeCompare(String(b.horario)));
  // Prompt 43, item 4: a agenda usa a mesma grade dos calendários do imóvel e da estadia (dias com horário marcados).
  const hoje = diaBRT(new Date());
  const marcasAgenda: Record<string, MarcaDia[]> = {};
  for (const p of agenda) {
    const dia = diaBRT(p.horario);
    if (dia) marcasAgenda[dia] = ["evento"];
  }
  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel id="pedidos" title="Pedidos" className="scroll-mt-24" data-testid="parceiro-pedidos">
        {pedidos.length === 0 ? (
          <VazioOnboardingBloco vazio={VAZIOS_ONBOARDING.pedidosParceiro} />
        ) : (
          <ul className="divide-y divide-line">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/servicos/pedidos/${p.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3" data-testid="parceiro-pedido">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {rotuloCategoria(p.categoria)} · {p.outroLado}
                    </span>
                    <span className="block text-xs text-muted">
                      {p.codigo}
                      {p.horario ? ` · ${dataHoraBRT(p.horario)}` : ""}
                      {/* Prompt 38: pedido que a Viva gerou pela regra do dono (imóvel fixo). */}
                      {p.automatico && <span data-testid="pedido-automatico"> · Automático</span>}
                    </span>
                    {proximoPasso(p.status, "parceiro") && <span className="block text-xs text-muted">{proximoPasso(p.status, "parceiro")}</span>}
                  </span>
                  <span className="text-sm font-semibold text-ink">{rotuloStatus(p.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid content-start gap-6">
        <Panel id="agenda" title="Agenda" className="scroll-mt-24" data-testid="parceiro-agenda">
          {hoje && (
            <div className="mb-3">
              <LegendaCalendario marcas={["evento", "hoje"]} />
              {mesesAPartirDe(hoje, 1).map(({ ano, mes }) => (
                <CalendarioMes key={`${ano}-${mes}`} tipo="agenda" ano={ano} mes={mes} hoje={hoje} marcas={marcasAgenda} />
              ))}
            </div>
          )}
          {agenda.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhum horário combinado" text="Quando um horário for confirmado num pedido, ele aparece aqui." />
          ) : (
            <ul className="divide-y divide-line">
              {agenda.map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/servicos/pedidos/${p.id}`} className="flex min-h-11 items-center justify-between gap-2 py-3 text-sm" data-testid="parceiro-agenda-item">
                    <span className="font-semibold text-ink">{dataHoraBRT(p.horario)}</span>
                    <span className="text-muted">{rotuloCategoria(p.categoria)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel id="ganhos" title="Ganhos" className="scroll-mt-24" data-testid="parceiro-ganhos">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-muted">Serviços fechados</dt>
            <dd className="text-right text-ink">{brl(total)}</dd>
            <dt className="text-muted">Taxa de serviço da Viva (10%)</dt>
            <dd className="text-right text-ink">{brl(taxa)}</dd>
            <dt className="font-semibold text-ink">Você recebe (90%)</dt>
            <dd className="text-right font-semibold text-ink">{brl(liquido)}</dd>
          </dl>
          {!pagamentoAtivo && <p className="mt-3 text-xs text-muted">Valores como {ROTULO_REGISTRO_SEM_DINHEIRO}: o pagamento pela plataforma ainda não está ativo.</p>}
        </Panel>
      </div>
    </div>
  );
}
