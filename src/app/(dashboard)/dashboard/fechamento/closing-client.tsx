"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { useDashDemo } from "@/lib/demo/demo-mode";
import { useExemplos } from "@/lib/demo/usar-exemplos";
import type { FechamentoContexto } from "@/lib/data/leads-actions";
import { ClosingFlow } from "./closing-flow";

/**
 * Fronteira demo/real do fechamento:
 *  - modo demonstração (admin) → fluxo completo sobre a candidatura de exemplo;
 *  - conta real COM candidatura aceita → fluxo sobre os dados reais herdados;
 *  - conta real SEM candidatura aceita → o fechamento NÃO existe: guarda que
 *    aponta para os interessados (fim do imóvel-amostra fixo).
 */
export function ClosingClient({ realCtx }: { realCtx: FechamentoContexto | null }) {
  const demo = useDashDemo();
  // A candidatura fictícia do modo demonstração vem do seed, sob demanda (E980): com o modo desligado, nem o arquivo é
  // pedido. Enquanto ele carrega (uma fração de segundo), a tela fica em branco em vez de piscar a guarda da conta real.
  const exemplos = useExemplos(demo);

  if (demo) return exemplos ? <ClosingFlow ctx={exemplos.DEMO_FECHAMENTO} demo /> : null;
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
