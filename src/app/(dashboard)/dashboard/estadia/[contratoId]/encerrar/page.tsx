import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/dashboard/primitives";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { EncerrarTela } from "./encerrar-tela";
import { VoltarLista } from "@/components/ui/voltar-lista";

export const metadata: Metadata = { title: "Encerrar contrato", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encerrar contrato (Prompt 32, item 7): motivo → consequências → confirmar na página. Com a chave
 * ENCERRAMENTO_REGRAS_ATIVO desligada (padrão, src/lib/flags.ts), nenhum valor é calculado: a Viva conduz.
 */
export default async function EncerrarPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  return (
    <div className="space-y-4" data-testid="pagina-encerrar">
      <VoltarLista href={HREF_ESTADIA(e.id)} rotulo="Minha estadia" />
      <PageTitle title="Encerrar contrato" subtitle={`${e.imovel.titulo} · Contrato ${e.numero}`} />
      {e.status !== "ativo" ? (
        <p className="text-sm text-muted">Este contrato já está encerrado.</p>
      ) : e.encerramento && e.encerramento.status !== "concluido" ? (
        <p className="text-sm text-muted" data-testid="encerrar-ja-pedido">Já existe um pedido de encerramento. A Viva está conduzindo com vocês.</p>
      ) : (
        <EncerrarTela contratoId={e.id} />
      )}
    </div>
  );
}
