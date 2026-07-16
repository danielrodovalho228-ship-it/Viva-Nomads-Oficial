import type { Metadata } from "next";
import { getFechamentoContext } from "@/lib/data/leads-actions";
import { ClosingClient } from "./closing-client";

export const metadata: Metadata = {
  title: "Fechamento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Rota do fechamento — SEMPRE valida no servidor. O contexto vem de uma
 * candidatura ACEITA real (imóvel, partes, valores + comissão congelada no
 * aceite); `?c=<leadId>` escolhe uma candidatura específica. Sem candidatura
 * aceita, o contexto é null e o cliente mostra a guarda (o fechamento não
 * existe sem ela). O modo demonstração (admin) usa o exemplo no cliente.
 */
export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const realCtx = await getFechamentoContext(c);
  return <ClosingClient realCtx={realCtx} />;
}
