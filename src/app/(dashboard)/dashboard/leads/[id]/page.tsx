import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { perfilDoCandidato } from "@/lib/data/leads";
import { leadSummary } from "@/lib/data/lead-types";
import { identidadeParaOutraParte } from "@/lib/identidade/estado";
import { linkCandidaturaDono } from "@/lib/notifications/dados-candidatura";

export const dynamic = "force-dynamic";
export const metadata = { title: "Perfil do candidato", robots: { index: false, follow: false } };

/**
 * E553 (parte B, rota e dados) — o perfil completo do candidato, aberto a partir do cartão de Interessados. Os dados vêm
 * de perfilDoCandidato (as mesmas regras de máscara do cartão: antes do aceite, "Candidato(a)", sem nome, foto ou
 * contato). As decisões (Recusar / Aprovar e responder) continuam no cartão; o "Voltar" leva a ele. O desenho final é
 * da Pista A.
 */
export default async function PerfilCandidatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await perfilDoCandidato(id);
  if (!l) notFound();
  const identidade = identidadeParaOutraParte(l.identidade);
  return (
    <div data-testid="perfil-candidato" data-candidatura={l.id}>
      <PageTitle title={l.name} subtitle={`Candidatura para ${l.property}`} />
      <Panel title="Resumo" className="mb-4">
        <p className="text-sm text-ink" data-testid="perfil-candidato-resumo">{leadSummary(l)}</p>
        <p className="mt-2 text-sm text-ink" data-testid="perfil-candidato-identidade" data-estado={l.identidade?.estado ?? "pendente"}>
          Identidade: {identidade.rotulo}
        </p>
        {l.moradorVerificado && <p className="mt-2 text-sm font-semibold text-forest">{l.moradorVerificado}</p>}
        {l.motivo && <p className="mt-2 text-sm text-ink">Motivo da estadia: {l.motivo}</p>}
      </Panel>
      {(l.selos?.length || l.reputacao) && (
        <Panel title="Selos e avaliações" className="mb-4">
          <ul className="space-y-1 text-sm text-ink" data-testid="perfil-candidato-selos">
            {l.selos?.map((s) => <li key={s}>{s}</li>)}
            {l.reputacao && (
              <li>
                {l.reputacao.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} · {l.reputacao.n} {l.reputacao.n === 1 ? "avaliação de proprietário" : "avaliações de proprietários"}
              </li>
            )}
          </ul>
        </Panel>
      )}
      {(l.sinais?.length || l.fichaPet || l.riskCategories.length) ? (
        <Panel title="Sobre a candidatura" className="mb-4">
          <ul className="space-y-1 text-sm text-ink" data-testid="perfil-candidato-sinais">
            {l.sinais?.map((s) => <li key={s}>{s}</li>)}
            {l.fichaPet && <li>{l.fichaPet}</li>}
            {l.riskCategories.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </Panel>
      ) : null}
      <ButtonLink href={linkCandidaturaDono(l.id)} variant="secondary" size="sm" data-testid="perfil-candidato-voltar">
        Voltar à candidatura
      </ButtonLink>
    </div>
  );
}
