import type { Metadata } from "next";
import { Video } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { listMinhasVisitas, listVisitasDono, type VisitaDono } from "@/lib/data/visitas-video-actions";
import { STATUS_VISITA_ROTULO, formatarHorario } from "@/lib/visitas-video";
import { AcoesVisitaDono, CancelarVisitaMorador } from "./acoes-visita";

export const metadata: Metadata = {
  title: "Visitas por vídeo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TOM = {
  pedido: "bg-blue-50 text-blue-700",
  confirmado: "bg-emerald-100 text-emerald-700",
  feito: "bg-slate-100 text-slate-700",
  cancelado: "bg-slate-100 text-slate-500",
} as const;

function Cartao({ v, dono }: { v: VisitaDono; dono: boolean }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-title text-base font-bold text-ink">{v.imovel}</h3>
          {v.motivo && <p className="text-xs text-muted">Motivo da estadia: {v.motivo}</p>}
        </div>
        <span data-testid="visita-status" className={`rounded-full px-3 py-1 text-xs font-semibold ${TOM[v.status]}`}>
          {STATUS_VISITA_ROTULO[v.status]}
        </span>
      </div>
      {v.status === "confirmado" && v.horarioConfirmado ? (
        <div className="mt-3 text-sm text-ink">
          <p>
            <strong>{formatarHorario(v.horarioConfirmado)}</strong>
          </p>
          {v.linkChamada && (
            <a
              href={v.linkChamada}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="visita-link-chamada"
              className="mt-1 inline-block break-all font-medium text-forest underline"
            >
              Entrar na chamada
            </a>
          )}
        </div>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm text-ink">
          {v.horarios.map((h) => (
            <li key={h} className="rounded-lg bg-surface-2 px-3 py-1.5">
              {formatarHorario(h)}
            </li>
          ))}
        </ul>
      )}
      {dono ? (
        <AcoesVisitaDono id={v.id} status={v.status} horarios={v.horarios} />
      ) : (
        (v.status === "pedido" || v.status === "confirmado") && <CancelarVisitaMorador id={v.id} />
      )}
    </Panel>
  );
}

export default async function VisitasPage() {
  const [recebidos, meus] = await Promise.all([listVisitasDono(), listMinhasVisitas()]);
  const vazio = recebidos.length === 0 && meus.length === 0;
  return (
    <>
      <PageTitle
        title="Visitas por vídeo"
        subtitle="Combine a chamada antes de visitar. Nome e contato do morador só aparecem depois do aceite."
      />
      {vazio ? (
        <EmptyState
          icon={Video}
          title="Nenhuma visita por vídeo ainda"
          text="Na página de um imóvel, toque em “Visita por vídeo”, escolha até 3 horários e acompanhe a resposta aqui."
          action={
            <ButtonLink href="/buscar" variant="primary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-6">
          {recebidos.length > 0 && (
            <section aria-labelledby="visitas-recebidas" data-testid="visitas-recebidas">
              <h2 id="visitas-recebidas" className="mb-3 font-title text-lg font-bold text-ink">
                Pedidos nos meus imóveis
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {recebidos.map((v) => (
                  <Cartao key={v.id} v={v} dono />
                ))}
              </div>
            </section>
          )}
          {meus.length > 0 && (
            <section aria-labelledby="visitas-minhas" data-testid="visitas-minhas">
              <h2 id="visitas-minhas" className="mb-3 font-title text-lg font-bold text-ink">
                Meus pedidos
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {meus.map((v) => (
                  <Cartao key={v.id} v={v} dono={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
