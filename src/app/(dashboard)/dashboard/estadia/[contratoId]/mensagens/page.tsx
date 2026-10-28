import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { carregarEstadia } from "@/lib/data/estadia";
import { programadasDaEstadia } from "@/lib/data/respostas-actions";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { ProgramadasTela } from "./programadas-tela";
import { VoltarLista } from "@/components/ui/voltar-lista";

export const metadata: Metadata = { title: "Mensagens programadas", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prompt 55-E2 — mensagens programadas da estadia (só o dono): 3 modelos, texto editável, envio pelo cron. */
export default async function MensagensProgramadasPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const [e, painel] = await Promise.all([carregarEstadia(contratoId), programadasDaEstadia(contratoId)]);
  if (!e || !painel) notFound();
  return (
    <div className="space-y-4" data-testid="pagina-programadas">
      <VoltarLista href={HREF_ESTADIA(contratoId)} rotulo="Minha estadia" />
      <PageTitle title="Mensagens programadas" subtitle={`${e.imovel.titulo} · Contrato ${e.numero}`} />
      <Panel>
        <p className="text-sm text-ink">
          Cada mensagem sai sozinha na conversa da estadia, no horário indicado. Se as datas mudarem por aditivo, o horário acompanha; se o contrato for
          encerrado, o que não saiu é cancelado. Nada sai entre 22h e 7h.
        </p>
        <p className="mt-1 text-sm text-muted">Telefone, e-mail, link de WhatsApp ou documento não podem ir no texto: a conversa fica registrada na Viva.</p>
      </Panel>
      {!painel.ativo ? (
        <Panel>
          <p className="text-sm text-muted" data-testid="programadas-encerrada">
            Esta estadia foi encerrada. As mensagens que não tinham saído foram canceladas.
          </p>
        </Panel>
      ) : null}
      <ProgramadasTela painel={painel} />
    </div>
  );
}
