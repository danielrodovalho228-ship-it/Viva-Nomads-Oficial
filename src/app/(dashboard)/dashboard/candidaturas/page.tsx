import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, MessageSquare } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { listMinhasCandidaturas } from "@/lib/data/leads-actions";
import type { RotuloCandidatura } from "@/lib/candidaturas/status";

export const metadata: Metadata = {
  title: "Minhas candidaturas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TOM: Record<RotuloCandidatura["tom"], string> = {
  neutro: "bg-slate-100 text-slate-700",
  andamento: "bg-blue-50 text-blue-700",
  sucesso: "bg-emerald-100 text-emerald-700",
  encerrado: "bg-slate-100 text-slate-500",
};

function dataBR(iso: string | null): string {
  if (!iso) return "";
  // Sem depender de locale do runtime: YYYY-MM-DD → DD/MM/AAAA.
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export default async function CandidaturasPage() {
  const candidaturas = await listMinhasCandidaturas();

  return (
    <>
      <PageTitle
        title="Minhas candidaturas"
        subtitle="Acompanhe suas candidaturas do envio até a resposta. A conversa segue sempre pela plataforma."
      />

      {candidaturas.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Você ainda não se candidatou"
          text="Quando você se candidatar a um imóvel, o acompanhamento aparece aqui — enviada, em análise e a resposta do proprietário."
          action={
            <ButtonLink href="/buscar" variant="primary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-3">
          {candidaturas.map((c) => (
            <Panel key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-title text-base font-bold text-ink">{c.propertyTitle}</h3>
                  {c.createdAt && (
                    <p className="text-xs text-muted">Enviada em {dataBR(c.createdAt)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${TOM[c.situacao.tom]}`}
                  >
                    {c.situacao.label}
                  </span>
                  {c.situacao.chave === "aceita" && (
                    <Link
                      href="/dashboard/mensagens"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
                    >
                      <MessageSquare className="h-4 w-4" /> Conversar
                    </Link>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
