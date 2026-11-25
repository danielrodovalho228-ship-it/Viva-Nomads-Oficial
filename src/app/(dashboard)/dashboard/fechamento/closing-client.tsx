"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { useDashDemo } from "@/lib/demo/demo-mode";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { COMMISSION_BY_PLAN } from "@/lib/constants";
import type { FechamentoContexto } from "@/lib/data/leads-actions";
import { ClosingFlow } from "./closing-flow";

/**
 * Contexto de DEMONSTRAÇÃO (admin, modo demo): candidatura aceita fictícia, com
 * o selo "Exemplo". Nunca aparece em conta real. consistency-ignore: persona de
 * demonstração, renderizada só sob o gate demo.
 */
const SAMPLE_CTX: FechamentoContexto = {
  leadId: "demo",
  property: SAMPLE_PROPERTIES.find((p) => p.id === "ube-001") ?? SAMPLE_PROPERTIES[0],
  tenantName: "Ana Carvalho", // consistency-ignore: persona de demonstração
  planoId: "essential",
  planoNome: "Essencial",
  comissaoRate: COMMISSION_BY_PLAN.essential,
  acceptedAt: "2026-01-15",
  contractNumber: "CTR-2026-0042", // consistency-ignore: nº de contrato de demonstração
};

/**
 * Fronteira demo/real do fechamento:
 *  - modo demonstração (admin) → fluxo completo sobre a candidatura de exemplo;
 *  - conta real COM candidatura aceita → fluxo sobre os dados reais herdados;
 *  - conta real SEM candidatura aceita → o fechamento NÃO existe: guarda que
 *    aponta para os interessados (fim do imóvel-amostra fixo).
 */
export function ClosingClient({ realCtx }: { realCtx: FechamentoContexto | null }) {
  const demo = useDashDemo();

  if (demo) return <ClosingFlow ctx={SAMPLE_CTX} demo />;
  if (realCtx) return <ClosingFlow ctx={realCtx} demo={false} />;

  return (
    <>
      <PageTitle
        title="Fechamento"
        subtitle="O fechamento começa quando você aceita um candidato — ele herda o imóvel, as partes e os valores da candidatura."
      />
      <EmptyState
        icon={Handshake}
        title="Nenhuma candidatura aceita ainda"
        text="Aceite um interessado em Interessados para iniciar o fechamento. Cada contrato nasce de uma candidatura aceita — nada de dados de exemplo."
        action={
          <ButtonLink href="/dashboard/leads" variant="primary">
            Ver interessados
          </ButtonLink>
        }
      />
    </>
  );
}
