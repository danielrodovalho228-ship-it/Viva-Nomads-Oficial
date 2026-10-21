import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA, acoesDaEstadia, textoEntrada, textoSaida } from "@/lib/estadia/estadia";
import { CAMPOS_INSTRUCOES } from "@/lib/estadia/instrucoes";
import { ROTULO_STATUS_ENCERRAMENTO, rotuloMotivo } from "@/lib/estadia/encerramento";
import { AditivoPendente, EditorInstrucoes, ListaPortaria, NotasPrivadas } from "./estadia-tela";

export const metadata: Metadata = {
  title: "Estadia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Página da estadia (Prompt 32, referência: a tela de reserva do anfitrião). A mesma URL para o dono e o morador;
 * cada papel vê a própria visão. Junta o que estava em Contratos, Locações e Fechamento (as telas continuam e apontam
 * para cá). Quem não é parte do contrato vê 404.
 */
export default async function EstadiaPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  const dono = e.papel === "proprietario";
  const acoes = acoesDaEstadia(e.id, e.topo.fase, `/dashboard/mensagens?conversa=${e.conversaId}`, dono ? "/dashboard/agenda" : `/dashboard/locacoes/${e.id}`);
  const aberto = e.aditivos.find((a) => a.status === "proposto" || a.status === "aceito");
  const assinados = e.aditivos.filter((a) => a.status === "assinado");

  return (
    <div data-testid="pagina-estadia" data-papel={e.papel} className="space-y-4">
      <PageTitle title={e.imovel.titulo} subtitle={`Contrato ${e.numero}`} />

      <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="estadia-topo">
        {e.imovel.foto && (
          // eslint-disable-next-line @next/next/no-img-element -- foto do anúncio, já reduzida no envio
          <img src={e.imovel.foto} alt={`Foto de ${e.imovel.titulo}`} className="aspect-[4/3] w-full rounded-xl object-cover sm:w-48" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-title text-xl font-bold text-ink" data-testid="estadia-topo-texto">
            {e.topo.texto}
          </p>
          <p className="text-sm text-ink" data-testid="estadia-entrada">{textoEntrada(e.periodo)}</p>
          <p className="text-sm text-ink" data-testid="estadia-saida">{textoSaida(e.periodo)}</p>
          <p className="text-xs text-muted">Horário de Brasília.</p>
        </div>
      </Panel>

      <nav aria-label="Ações desta estadia" className="flex flex-wrap gap-2" data-testid="estadia-acoes">
        {acoes.map((a) => (
          <ButtonLink key={a.id} href={a.href} variant={a.primaria ? "primary" : "secondary"} size="sm" data-testid={`estadia-acao-${a.id}`}>
            {a.rotulo}
          </ButtonLink>
        ))}
      </nav>

      {e.encerramento && (
        <Panel title="Pedido de encerramento" data-testid="estadia-encerramento">
          <p className="text-sm text-ink">
            {ROTULO_STATUS_ENCERRAMENTO[e.encerramento.status] ?? "Pedido recebido"} · {rotuloMotivo(e.encerramento.motivo)}
          </p>
          <p className="mt-1 text-sm text-muted">A Viva conduz o encerramento com vocês. Nenhum valor foi calculado pela plataforma.</p>
        </Panel>
      )}

      {aberto && <AditivoPendente aditivo={aberto} papel={e.papel} />}

      {e.topo.fase !== "encerrada" && (
        <Panel title="Antes da entrada" data-testid="estadia-checklist">
          <ul className="space-y-3">
            {e.checklist.map((i) => (
              <li key={i.chave} className="flex items-start gap-3" data-testid={`checklist-${i.chave}`} data-feito={i.feito ? "sim" : "nao"}>
                {i.feito ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{i.rotulo}</span>
                  <span className="block text-sm text-muted">{i.detalhe}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Quem vai morar" data-testid="estadia-moradores">
          <div className="flex items-center gap-3">
            <Avatar photoUrl={e.morador.foto ?? undefined} name={e.morador.nome} size={48} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{e.morador.nome}</p>
              <p className="text-xs text-muted">Morador principal</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-ink" data-testid="estadia-ocupantes">
            {e.ocupantes.map((o) => (
              <li key={o.id}>
                {o.nome}
                {o.relacao ? <span className="text-muted"> · {o.relacao}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            {e.ocupantes.length} de {e.ocupantesPrevistos} ocupantes preenchidos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {e.podeEditarOcupantes && (
              <ButtonLink href={`${HREF_ESTADIA(e.id)}/ocupantes`} variant="secondary" size="sm" data-testid="estadia-preencher-ocupantes">
                Preencher ocupantes
              </ButtonLink>
            )}
            {e.ocupantes.length > 0 && <ListaPortaria contratoId={e.id} />}
          </div>
        </Panel>

        <Panel title="Valores" data-testid="estadia-valores">
          <dl className="space-y-3">
            {e.valores.map((v) => (
              <div key={v.chave} data-testid={`valor-${v.chave}`}>
                <dt className="text-sm font-semibold text-ink">
                  {v.rotulo}: {v.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </dt>
                <dd className="text-sm text-muted">{v.detalhe}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Instruções de chegada" id="instrucoes" data-testid="estadia-instrucoes">
        {dono ? (
          <EditorInstrucoes propertyId={e.imovel.id} contratoId={e.id} inicial={e.instrucoes.campos ?? {}} comoEntrarDoContrato={e.instrucoes.comoEntrarDoContrato} />
        ) : e.instrucoes.liberadas && e.instrucoes.campos ? (
          <dl className="space-y-3" data-testid="instrucoes-liberadas">
            {CAMPOS_INSTRUCOES.filter((c) => (e.instrucoes.campos?.[c.chave] ?? "").trim()).map((c) => (
              <div key={c.chave}>
                <dt className="text-sm font-semibold text-ink">{c.rotulo}</dt>
                <dd className="whitespace-pre-line text-sm text-ink">{e.instrucoes.campos?.[c.chave]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted" data-testid="instrucoes-bloqueadas">
            {e.instrucoes.texto || "O proprietário ainda não publicou as instruções."}
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Documentos" data-testid="estadia-documentos">
          <p className="text-sm text-ink">
            {e.documentos === 0 ? "Nenhum recibo ou comprovante emitido ainda." : `${e.documentos} ${e.documentos === 1 ? "documento" : "documentos"} deste contrato.`}
          </p>
          <ButtonLink href={dono ? `/dashboard/contratos#contrato-${e.id}` : `/dashboard/locacoes#contrato-${e.id}`} variant="tertiary" size="sm" className="mt-2">
            Ver recibos e comprovantes
          </ButtonLink>
        </Panel>

        <Panel title="Suas notas" data-testid="estadia-notas">
          <NotasPrivadas contratoId={e.id} inicial={e.nota} />
        </Panel>
      </div>

      {assinados.length > 0 && (
        <Panel title="Histórico do contrato" data-testid="estadia-historico">
          <ul className="space-y-1 text-sm text-ink">
            {assinados.map((a) => (
              <li key={a.id}>
                {a.historico}
                {a.taxa && <span className="block text-xs text-muted">{a.taxa.base}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
