import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { LinhaDoTempoEstadia } from "@/components/contrato/linha-do-tempo-estadia";
import { createClient } from "@/lib/supabase/server";
import { carregarVisaoConvidado } from "@/lib/data/estadia-convidados";
import { entradaDoConvidado } from "@/lib/anuncio/chegada-e-pedido";
import { textoEntrada, textoSaida } from "@/lib/estadia/estadia";
import { CAMPOS_INSTRUCOES } from "@/lib/estadia/instrucoes";
import { montarLinhaDoTempo } from "@/lib/estadia-linha-tempo";

export const metadata: Metadata = {
  title: "Estadia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 61-B — a estadia vista por quem o morador convidou: SÓ LEITURA. Datas, endereço, instruções de chegada (depois do
 * D-7) e a linha do tempo. Nunca valores, contrato, Caução, documentos, recibos ou conversa. Sem convite ativo
 * (nunca convidado, ou removido pelo morador), 404: o acesso cai na hora.
 */
export default async function EstadiaConvidadoPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect(entradaDoConvidado(contratoId));
  const v = await carregarVisaoConvidado(contratoId);
  if (!v) notFound();
  const etapas = montarLinhaDoTempo({
    inicio: v.periodo.inicio,
    fim: v.periodo.fim,
    checkinAfter: v.periodo.checkinAfter ?? null,
    checkoutBefore: v.periodo.checkoutBefore ?? null,
  });

  return (
    <div data-testid="pagina-estadia-convidado" className="space-y-4">
      <PageTitle title={v.imovel.titulo} subtitle="Você foi incluído nesta estadia pelo morador" />

      <Panel title="Datas" data-testid="convidado-datas">
        <p className="text-sm text-ink" data-testid="convidado-entrada">{textoEntrada(v.periodo)}</p>
        <p className="text-sm text-ink" data-testid="convidado-saida">{textoSaida(v.periodo)}</p>
        <p className="mt-1 text-xs text-muted">Horário de Brasília.</p>
      </Panel>

      <Panel title="Endereço" data-testid="convidado-endereco">
        <p className="text-sm text-ink">{v.endereco}</p>
      </Panel>

      <LinhaDoTempoEstadia etapas={etapas} semMensagens />

      <Panel title="Instruções de chegada" data-testid="convidado-instrucoes">
        {v.instrucoes.liberadas && v.instrucoes.campos ? (
          <dl className="space-y-3" data-testid="convidado-instrucoes-liberadas">
            {CAMPOS_INSTRUCOES.filter((c) => (v.instrucoes.campos?.[c.chave] ?? "").trim()).map((c) => (
              <div key={c.chave}>
                <dt className="text-sm font-semibold text-ink">{c.rotulo}</dt>
                <dd className="whitespace-pre-line text-sm text-ink">{v.instrucoes.campos?.[c.chave]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted" data-testid="convidado-instrucoes-bloqueadas">
            {v.instrucoes.texto || "O proprietário ainda não publicou as instruções."}
          </p>
        )}
      </Panel>

      <p className="text-xs text-muted">Valores, contrato e conversa ficam com o morador. Dúvidas sobre a estadia, fale com quem convidou você.</p>
    </div>
  );
}
