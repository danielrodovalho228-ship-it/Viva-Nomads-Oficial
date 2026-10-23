import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA, textoEntrada, textoSaida } from "@/lib/estadia/estadia";
import { acoesDaEstadia, encerrarDaEstadia, mensagemDaEstadia, type ContratoDaEstadia } from "@/lib/estadia/acoes";
import { CAMPOS_INSTRUCOES } from "@/lib/estadia/instrucoes";
import { ROTULO_STATUS_ENCERRAMENTO, rotuloMotivo } from "@/lib/estadia/encerramento";
import { AcoesEstadia } from "@/components/estadia/acoes-estadia";
import { CartaoAjudaMudanca, CartaoDepoisDaSaida } from "@/components/automacao/cartoes-estadia";
import { depoisDaSaida, sugestaoMorador } from "@/lib/automacao/estadia";
import { AditivoPendente, EditorInstrucoes, ListaPortaria, NotasPrivadas } from "./estadia-tela";
import { CalendarioMes, LegendaCalendario } from "@/components/calendario/calendario-mes";
import { ValorDiretoAoProprietario } from "@/components/contexto/cabecalho-contexto";
import { marcasDaEstadia } from "@/lib/calendario/grade";
import Link from "next/link";
import { LinhaDoTempoEstadia } from "@/components/contrato/linha-do-tempo-estadia";
import { LocalEstadia } from "@/components/estadia/local-estadia";
import { montarLinhaDoTempo } from "@/lib/estadia-linha-tempo";
import { HREF_CONFIRMADA } from "@/lib/estadia/confirmacao";
import { aditivoEmTela } from "@/lib/estadia/aditivo-em-tela";
import { localDaEstadia } from "@/lib/data/estadia-local";

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
 * Prompt 41 (adendo da estadia): um primário só, "Mensagem", no cartão de status; o resto das ações mora no cogumelo
 * "Ações desta estadia"; "Encerrar contrato" fica no fim da página, em texto vermelho (a confirmação é na /encerrar).
 * A lista sai de src/lib/estadia/acoes.ts.
 */
export default async function EstadiaPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  const dono = e.papel === "proprietario";
  const contrato: ContratoDaEstadia = {
    id: e.id,
    fase: e.topo.fase,
    conversaId: e.conversaId,
    imovelId: e.imovel.id,
    cidade: e.imovel.cidade,
    instrucoesLiberadas: e.instrucoes.liberadas,
  };
  const mensagem = mensagemDaEstadia(contrato);
  const encerrar = encerrarDaEstadia(e.papel, contrato);
  const aberto = aditivoEmTela(e.aditivos);
  const assinados = e.aditivos.filter((a) => a.status === "assinado");
  const [depois, sugestao, local] = await Promise.all([
    dono ? depoisDaSaida(e.id, e.imovel.id) : Promise.resolve(null),
    !dono && e.topo.fase !== "encerrada" ? sugestaoMorador(e.periodo, e.imovel.cidade) : Promise.resolve(null),
    // Prompt 61-A: o endereço exato só com o contrato assinado pelas duas partes; antes, a região aproximada.
    localDaEstadia(e.imovel.id, e.assinadoPorAmbos),
  ]);
  // Prompt 61-A: a linha do tempo com os horários do imóvel (checkin_after / checkout_before), a mesma fonte do prazo
  // da conferência; nada recalculado aqui.
  const etapas = montarLinhaDoTempo({
    inicio: e.periodo.inicio,
    fim: e.periodo.fim,
    checkinAfter: e.periodo.checkinAfter ?? null,
    checkoutBefore: e.periodo.checkoutBefore ?? null,
  });

  return (
    <div data-testid="pagina-estadia" data-papel={e.papel} className="space-y-4">
      <PageTitle title={e.imovel.titulo} subtitle={`Contrato ${e.numero}`} />

      <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="estadia-topo">
        {e.imovel.foto && (
          // eslint-disable-next-line @next/next/no-img-element -- foto do anúncio, já reduzida no envio
          <img src={e.imovel.foto} alt={`Foto de ${e.imovel.titulo}`} className="aspect-[4/3] w-full rounded-xl object-cover sm:w-48" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-title text-xl font-semibold text-ink" data-testid="estadia-topo-texto">
            {e.topo.texto}
          </p>
          <p className="text-sm text-ink" data-testid="estadia-entrada">{textoEntrada(e.periodo)}</p>
          <p className="text-sm text-ink" data-testid="estadia-saida">{textoSaida(e.periodo)}</p>
          <p className="text-xs text-muted">Horário de Brasília.</p>
          {e.assinadoPorAmbos && (
            <Link href={HREF_CONFIRMADA(e.id)} className="text-sm text-forest underline underline-offset-2" data-testid="estadia-ver-confirmacao">
              Ver a confirmação da estadia
            </Link>
          )}
          <div className="pt-2">
            {/* O único primário da tela (Prompt 41). */}
            <ButtonLink href={mensagem.href} variant="primary" size="sm" data-testid="estadia-acao-mensagem">
              {mensagem.rotulo}
            </ButtonLink>
          </div>
        </div>
      </Panel>

      <LinhaDoTempoEstadia etapas={etapas} semMensagens />

      {(e.periodo.inicio || e.periodo.fim) && (
        // Prompt 43, item 4: o calendário da estadia usa a mesma grade do calendário do imóvel e da agenda do parceiro.
        <Panel title="Calendário da estadia" data-testid="estadia-calendario">
          <LegendaCalendario marcas={["entrada", "periodo", "saida"]} />
          <div className="grid gap-4 sm:grid-cols-2">
            {[...new Set([e.periodo.inicio, e.periodo.fim].filter((d): d is string => !!d).map((d) => d.slice(0, 7)))].map((am) => (
              <CalendarioMes
                key={am}
                tipo="estadia"
                ano={Number(am.slice(0, 4))}
                mes={Number(am.slice(5, 7)) - 1}
                marcas={marcasDaEstadia(e.periodo.inicio, e.periodo.fim)}
              />
            ))}
          </div>
        </Panel>
      )}

      {local && <LocalEstadia local={local} imovelId={e.imovel.id} />}

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
                {i.feito ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden /> : <Circle className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden />}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{i.rotulo}</span>
                  <span className="block text-sm text-muted">{i.detalhe}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Prompt 38: o dono vê o que a Viva pediu para depois da saída; o morador, a sugestão de parceiros (D-7). */}
      {depois && <CartaoDepoisDaSaida dados={depois} propertyId={e.imovel.id} />}
      {sugestao && <CartaoAjudaMudanca dados={sugestao} />}

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
          <ValorDiretoAoProprietario className="mt-3 text-sm text-muted" />
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

      {encerrar && (
        // Destrutivo = texto vermelho, nunca primário; a confirmação é na própria página /encerrar (motivo → consequências → confirmar).
        <div className="border-t border-divisor pt-4" data-testid="estadia-fim">
          <ButtonLink href={encerrar.href} variant="destructive" size="sm" data-testid="estadia-acao-encerrar">
            {encerrar.rotulo}
          </ButtonLink>
        </div>
      )}

      <AcoesEstadia acoes={acoesDaEstadia(e.papel, contrato)} />
    </div>
  );
}
