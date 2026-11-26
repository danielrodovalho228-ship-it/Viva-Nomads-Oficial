"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { useDashDemo } from "@/lib/demo/demo-mode";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { COMMISSION_BY_PLAN } from "@/lib/constants";
import type { FechamentoContexto } from "@/lib/data/leads-actions";
import type { LinhaDoFecho } from "@/lib/fechamento/fechos-do-dono";
import { ClosingFlow } from "./closing-flow";
import { SeusFechamentos, TEXTOS_FECHOS } from "./seus-fechamentos";

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
/** E1090: os fechos do dono, já na ordem (a regra pura decide), e a linha que o assistente mostra agora. */
export interface FechosDaPagina {
  linhas: LinhaDoFecho[];
  foraDoTeto: number;
  /** A chave da linha que o assistente aberto mostra. */
  atual: string | null;
  /** R9: o `?c=` pedido não é um fechamento deste dono. */
  naoEncontrado: boolean;
  /** Caso 12: há candidaturas aceitas, mas nenhuma por fechar. */
  temAceitas: boolean;
}

export function ClosingClient({ realCtx, fechos = null }: { realCtx: FechamentoContexto | null; fechos?: FechosDaPagina | null }) {
  const demo = useDashDemo();

  // R11: a demonstração do admin fica como está — o exemplo fixo, sem lista.
  if (demo) return <ClosingFlow ctx={SAMPLE_CTX} demo />;

  // R5: com um fecho só, a tela fica como antes, sem lista; com dois ou mais (ou um `?c=` que não é do dono), a lista
  // aparece por cima do assistente.
  const lista =
    fechos && fechos.linhas.length > 0 && (fechos.linhas.length > 1 || fechos.naoEncontrado || !realCtx) ? (
      <SeusFechamentos linhas={fechos.linhas} foraDoTeto={fechos.foraDoTeto} atual={fechos.atual} naoEncontrado={fechos.naoEncontrado} />
    ) : null;

  if (realCtx)
    return (
      <>
        {lista}
        {/* E1201: uma instância por estadia (candidatura + proposta). "Abrir fechamento" na lista navega no cliente
            para a mesma página; sem a key, o estado do fecho anterior (a data de início, que vai ao contrato, o prazo,
            os ocupantes, o passo, o "gerado"…) atravessava para o novo. */}
        <ClosingFlow key={`${realCtx.leadId}:${realCtx.proposta?.id ?? ""}`} ctx={realCtx} demo={false} />
      </>
    );
  if (lista)
    return (
      <>
        <PageTitle title="Fechamento" subtitle="Os seus fechamentos, do que espera por você ao que já está fechado." />
        {lista}
      </>
    );

  // Caso 12 (R10): há aceitas, mas todas voltaram ao dono (pré-aceitação expirada, sem contrato) — não é "nenhuma aceita".
  if (fechos?.temAceitas)
    return (
      <>
        <PageTitle title="Fechamento" subtitle="O fechamento começa quando você aceita um candidato — ele herda o imóvel, as partes e os valores da candidatura." />
        <EmptyState
          icon={Handshake}
          title={TEXTOS_FECHOS.semPorFecharTitulo}
          text={TEXTOS_FECHOS.semPorFecharTexto}
          action={
            <ButtonLink href="/dashboard/leads" variant="primary">
              Ver interessados
            </ButtonLink>
          }
        />
      </>
    );

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
