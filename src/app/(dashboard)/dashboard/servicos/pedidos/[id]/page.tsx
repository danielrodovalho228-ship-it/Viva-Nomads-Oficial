import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/dashboard/primitives";
import { detalheDoPedido } from "@/lib/parceiros/pedido-actions";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { PedidoParceiroTela } from "./pedido-tela";

export const metadata: Metadata = {
  title: "Pedido de serviço",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pedido de serviço de parceiro (Prompt 31b): a mesma tela para o cliente e para o parceiro; quem não é parte vê 404. */
export default async function PedidoParceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const d = await detalheDoPedido(id);
  if (!d) notFound();
  const titulo = d.papel === "cliente" ? `${rotuloCategoria(d.categoria)} com ${d.parceiro.nome}` : `${rotuloCategoria(d.categoria)} para ${d.cliente.nome}`;
  return (
    <>
      <PageTitle title={titulo} subtitle={`Pedido ${d.orcamentoRotulo ?? d.codigo}`} />
      <PedidoParceiroTela d={d} pagamentoAtivo={PAGAMENTO_PARCEIROS_ATIVO} />
    </>
  );
}
