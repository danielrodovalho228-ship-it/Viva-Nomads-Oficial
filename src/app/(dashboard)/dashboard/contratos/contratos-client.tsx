"use client";

import { duracaoDoBloco, rotuloPagamentoBloco } from "@/lib/pagamento-bloco";
import { ROTULO_CONTAS, ROTULO_LIMPEZA, emAbertoNoBloco, encargosDosComponentes, somarComponentes, textoComponentes, type ComponentesBloco } from "@/lib/pagamento-componentes";
import { estadoCaucao } from "@/lib/caucao-estado";
import { AnularRegistro } from "@/components/anulacao/anular-registro";
import { MSG_CAUCAO_NADA_NO_BLOCO, linhasDaCaucaoPorBloco } from "@/lib/caucao-teto";
import { CampoReais } from "@/components/ui/campo-reais";
import { CampoData } from "@/components/ui/campo-data";
import { ProblemaComIsto } from "@/components/ajuda/problema-com-isto";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import {
  ShieldCheck,
  Check,
  Clock,
  Lock,
  CalendarDays,
  Plus,
  CircleDollarSign,
  Users,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ValorDiretoAoProprietario } from "@/components/contexto/cabecalho-contexto";
import { Button, ButtonLink } from "@/components/ui/button";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { useExemplos } from "@/lib/demo/usar-exemplos";
import type { DemoContract } from "@/lib/demo/seed";
import {
  planejarBlocos,
  encadearDatas,
  comissaoContrato,
  DIAS_POR_MES,
} from "@/lib/contrato-blocos";
import { COMISSAO_POR_PLANO } from "@/config/planos";
import {
  marcarPagamentoRecebido,
  type ContratoView,
  type BlocoView,
} from "@/lib/data/contratos-actions";
import { AvaliacaoForm } from "@/components/avaliacao-form";
import { ancoraAvaliacao } from "@/lib/avaliacoes";
import { AvisoDocumentosFalhou, DevolucaoCaucaoDono, ListaDocumentos } from "@/components/documentos/documentos-contrato";
import type { documentosDosContratos } from "@/lib/data/documentos-actions";
import { STATUS_CONTRATO_ENCERRADO } from "@/lib/fiscal/devolucao";

type Extras = Awaited<ReturnType<typeof documentosDosContratos>>;
import { formatBRL, cn } from "@/lib/utils";
import { ROTULO_MENSAL, formatBRLExato } from "@/lib/precos";
import { type EtapaContrato } from "@/lib/contrato-etapas";
import { rotuloDoBloco } from "@/lib/bloco-status";
import { estadoDoContratoUnico, tomDoSelo } from "@/lib/contrato-estado";
import { rotuloBaseTaxa } from "@/lib/taxa-servico-base";
import { hrefContratoDono } from "@/lib/contratos/area-dono";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { saidaPeloFim } from "@/lib/texto-do-periodo";

/** Texto imutável da regra de ouro (declaratório — nunca movimenta valores). */
const REGRA_PAGAMENTO =
  "O pagamento é feito direto ao proprietário. A plataforma registra e documenta — não movimenta valores.";

const FORMA_LABEL: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  outro: "Outro",
};


/**
 * Constrói contratos de DEMONSTRAÇÃO (admin) a partir do seed, sintetizando os
 * blocos com as regras reais (blocos de 2 meses, caução 50%) e um pagamento já
 * confirmado no 1º bloco — para o piloto/investidor ver o fluxo declaratório.
 */
/** Trilha de comissão dos contratos de DEMONSTRAÇÃO: a do Profissional (config/planos). */
const DEMO_COMISSAO_PCT = COMISSAO_POR_PLANO.pro;

function buildDemoContratos(hojeISO: string, exemplos: readonly DemoContract[]): ContratoView[] {
  return exemplos.map((c, ci) => {
    // Prazo total plausível (~6 meses) para render um belo encadeamento.
    const prazoMeses = 6;
    const planos = planejarBlocos(prazoMeses, c.valorMes, 2);
    const comDatas = encadearDatas(c.inicio, planos);
    const blocos: BlocoView[] = comDatas.map((b, i) => {
      const status =
        b.fim < hojeISO ? "renovado" : b.inicio <= hojeISO ? "ativo" : "agendado";
      return {
        id: `demo-bloco-${ci}-${b.numero}`,
        numeroBloco: b.numero,
        inicio: b.inicio,
        fim: b.fim,
        meses: b.meses,
        valor: b.valor,
        caucao: b.caucao,
        caucaoForma: "avista",
        caucaoStatus: i === 0 ? "comprovada" : "pendente",
        status,
      };
    });
    // Um pagamento de aluguel já confirmado no 1º bloco (histórico declaratório).
    const b0 = blocos[0];
    const pagamentos = b0
      ? [
          {
            id: `demo-pg-${ci}`,
            blocoId: b0.id,
            tipo: "aluguel",
            valor: b0.valor, // bloco 1 quitado (aluguel × meses do bloco)
            forma: "pix",
            dataPagamento: c.inicio,
            confirmado: true,
            observacao: null,
            rotulo: rotuloPagamentoBloco({
              tipo: "aluguel",
              valor: b0.valor,
              bloco: { numero: b0.numeroBloco, meses: b0.meses, inicio: b0.inicio, fim: b0.fim },
              valorMensal: c.valorMes,
              prazoTotalDias: prazoMeses * DIAS_POR_MES,
              comConta: true,
            }),
          },
        ]
      : [];
    return {
      id: `demo-contrato-${ci}`,
      propertyId: `demo-prop-${ci}`,
      propertyTitle: c.imovel,
      tenantId: `demo-tenant-${ci}`,
      city: "",
      aluguelMensal: c.valorMes,
      prazoTotalDias: prazoMeses * DIAS_POR_MES,
      tamanhoBlocoMeses: 2,
      // Comissão = taxa × valor total do contrato (aluguel × meses), UMA vez.
      comissaoValor: comissaoContrato(c.valorMes, prazoMeses, DEMO_COMISSAO_PCT),
      comissaoPercent: DEMO_COMISSAO_PCT,
      qtdOcupantes: 1 + (ci % 3),
      status: "ativo",
      // Demonstração: assinado e com o pagamento do 1º bloco confirmado — o estado sai da mesma fonte única.
      ...(() => {
        const estado = estadoDoContratoUnico(
          { status: "ativo", assinado_proprietario_em: c.inicio, assinado_inquilino_em: c.inicio, pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: true }] },
          "proprietario",
        );
        return { estado, etapa: estado.etapa ?? ("em_vigencia" as const) };
      })(),
      criadoEm: c.inicio,
      blocos,
      pagamentos,
      caucao: estadoCaucao({ blocos, pagamentos }),
      podeAvaliar: false,
      fimParaAvaliacao: null,
      minhaAvaliacao: null,
    };
  });
}

export function ContratosClient({
  contratos: real,
  hojeISO,
  extras = {},
  conferenciaPendente = null,
}: {
  contratos: ContratoView[];
  hojeISO: string;
  extras?: Extras;
  /** PROP-5: o contrato com a conferência de entrada pendente (o atalho #conferencia abre ele). */
  conferenciaPendente?: string | null;
}) {
  const { on: demoOn } = useDemoMode();
  const router = useRouter();
  // PROP-5: a conferência mora dentro do contrato. O atalho antigo /dashboard/contratos#conferencia leva ao contrato com
  // a conferência pendente; sem pendência, a lista fica onde está.
  useEffect(() => {
    if (demoOn || !conferenciaPendente || window.location.hash !== "#conferencia") return;
    router.replace(`${hrefContratoDono(conferenciaPendente)}#conferencia`);
  }, [demoOn, conferenciaPendente, router]);
  // E980: os exemplos chegam sob demanda (só com a demonstração ligada).
  const exemplos = useExemplos(demoOn);
  const demoContratos = useMemo(() => buildDemoContratos(hojeISO, exemplos?.DEMO_CONTRACTS ?? []), [hojeISO, exemplos]);
  const contratos = demoOn ? demoContratos : real;

  return (
    <>
      <PageTitle
        title="Contratos & blocos"
        subtitle="Acompanhe cada contrato, seus blocos e registre os recebimentos."
        action={demoOn ? <DemoBadge /> : undefined}
      />
      <ValorDiretoAoProprietario className="-mt-2 mb-4 text-sm text-muted" />

      {/* Regra de ouro — sempre visível no topo. */}
      <div className="mb-6 flex items-start gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted">
        <Lock className="mt-1 h-4 w-4 shrink-0 text-sage" />
        <span>{REGRA_PAGAMENTO}</span>
      </div>

      {/* PROP-5: a conferência é uma etapa dentro de cada contrato (linha do tempo do detalhe). A âncora fica para o
          atalho antigo quando não há conferência pendente. */}
      <p id="conferencia" className="mb-6 scroll-mt-24 text-sm text-muted" data-testid="contratos-conferencia-aviso">
        <strong className="font-semibold text-ink">Conferência de entrada e saída:</strong> fica dentro de cada contrato, na linha do tempo da estadia.
      </p>

      {contratos.length === 0 ? (
        <EmptyState
          title="Nenhum contrato ainda"
          text="Seu primeiro fechamento aparece aqui — o contrato, os blocos e o registro dos recebimentos."
          action={
            <ButtonLink href="/dashboard/fechamento" variant="gold">
              Ir para o fechamento
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          {contratos.map((c) => (
            <ContratoCard key={c.id} contrato={c} hojeISO={hojeISO} demo={demoOn} extra={demoOn ? undefined : extras[c.id]} />
          ))}
        </div>
      )}
    </>
  );
}

function ContratoCard({
  contrato,
  hojeISO,
  demo,
  extra,
}: {
  contrato: ContratoView;
  hojeISO: string;
  demo: boolean;
  extra?: Extras[string];
}) {
  // E1072: o registrado de cada bloco soma o aluguel, as contas e a limpeza de cada registro.
  const pagosPorBloco = useMemo(() => {
    const m = new Map<string, ComponentesBloco[]>();
    for (const p of contrato.pagamentos) {
      if (p.tipo !== "aluguel" || !p.blocoId) continue;
      m.set(p.blocoId, [...(m.get(p.blocoId) ?? []), p.componentes ?? { aluguel: p.valor, contas: 0, limpeza: 0, total: p.valor }]);
    }
    return new Map([...m].map(([id, itens]) => [id, somarComponentes(itens)]));
  }, [contrato.pagamentos]);

  const totalPeriodo = contrato.blocos.reduce((s, b) => s + b.valor, 0);
  const caucaoTotal = contrato.blocos.reduce((s, b) => s + b.caucao, 0);
  // E1225: a caução de ANTES (no contrato, sem bloco) e as linhas por bloco com o teto acumulado.
  const caucaoAntiga = contrato.pagamentos.find((p) => p.tipo === "caucao" && !p.blocoId) ?? null;
  const linhasCaucao = linhasDaCaucaoPorBloco(
    contrato.blocos.map((b) => ({ id: b.id, numero: b.numeroBloco, caucao: b.caucao })),
    contrato.pagamentos,
  );

  return (
    <Panel className="p-4" id={`contrato-${contrato.id}`} data-testid="contrato-cartao" data-contrato={contrato.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-title text-lg font-semibold text-ink">{contrato.propertyTitle}</h2>
          {!demo && <ProblemaComIsto tipo="contrato" id={contrato.id} className="mt-1" />}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <CircleDollarSign className="h-3.5 w-3.5" /> {ROTULO_MENSAL} {formatBRL(contrato.aluguelMensal)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {contrato.blocos.length}{" "}
              {contrato.blocos.length === 1 ? "bloco" : "blocos"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {contrato.qtdOcupantes} ocupante(s)
            </span>
            {contrato.blocos[0] && (
              <span className="inline-flex items-center gap-1" data-testid="contrato-inicio">
                <CalendarDays className="h-3.5 w-3.5" /> Início da estadia: {formatDate(contrato.blocos[0].inicio)}
              </span>
            )}
          </div>
        </div>
        <span
          className={cn("rounded-full px-3 py-1 text-xs font-medium", tomDoSelo(contrato.estado))}
          data-testid="contrato-etapa"
          data-chave={contrato.estado.chave}
        >
          {contrato.estado.selo}
        </span>
      </div>

      {!demo && (
        <Link
          href={`/dashboard/contratos/${contrato.id}`}
          className="mt-3 inline-block text-sm font-medium text-forest underline"
          data-testid="contrato-ver-assinar"
        >
          {contrato.status === "ativo" && contrato.etapa === "aguardando_assinatura" ? "Ver e assinar contrato" : "Ver contrato"}
        </Link>
      )}
      {/* Prompt 32: a página da estadia junta datas, checklist, ocupantes, valores, instruções e alterações. */}
      {!demo && (
        <Link href={HREF_ESTADIA(contrato.id)} className="ml-4 mt-3 inline-block text-sm font-medium text-forest underline" data-testid="contrato-abrir-estadia">
          Abrir a página da estadia
        </Link>
      )}

      {/* Taxa de serviço (contrato-mãe) com a BASE REAL gravada no aceite (prompt 23): 1 mês nos contratos antigos,
          valor mensal × meses nos novos, no rótulo único do prompt 27. Sem afirmar regra de renovação (aguarda a Dra. Beatriz). */}
      <p className="mt-3 rounded-lg bg-champagne/10 px-3 py-2 text-xs text-forest" data-testid="contrato-taxa">
        Taxa de serviço:{" "}
        <span data-testid="contrato-taxa-base">
          {rotuloBaseTaxa({
            valor: contrato.comissaoValor,
            percent: contrato.comissaoPercent,
            aluguelMensal: contrato.aluguelMensal,
            meses: Math.round(contrato.prazoTotalDias / DIAS_POR_MES),
            aceiteEm: contrato.aceiteEm ?? null,
          })}
        </span>{" "}
        — cobrada à parte, do proprietário; o valor mensal vai direto a você.
      </p>

      {/* Caução do CONTRATO (complemento do #884): item próprio, fora dos cartões de bloco: a Caução nunca leva número de bloco. */}
      {caucaoTotal > 0 && (
        <div className="mt-4 rounded-xl border border-sage-200 p-4" data-testid="caucao-contrato">
          <p className="text-sm font-medium text-ink" data-testid="caucao-contrato-rotulo">
            Caução do contrato — {formatBRL(caucaoTotal)}
          </p>
          {/* L2-B item 13: o mesmo estado que a Garantias e a tela do inquilino mostram (estadoCaucao). */}
          <p className="mt-1 text-xs text-muted" data-testid="caucao-contrato-estado" data-chave={contrato.caucao.chave}>
            {contrato.caucao.rotulo}
          </p>
          {/* A caução de antes, registada no contrato pela soma (antes do E1225). */}
          {caucaoAntiga && (
            <p className="mt-1 inline-flex items-center gap-2 text-xs text-forest" data-testid="caucao-contrato-status">
              <Check className="h-3.5 w-3.5" />
              {caucaoAntiga.confirmado
                ? "Recebimento registrado e confirmado pelo morador."
                : "Recebimento registrado. Aguardando a confirmação do morador."}
            </p>
          )}
          {contrato.etapa === "aguardando_assinatura" ? (
            <p className="mt-1 text-xs text-muted">O registro da Caução abre depois que as duas partes assinarem.</p>
          ) : (
            /* E1225 (ORDENS-DUET 1120 e 1127): uma linha por bloco — o registro dele, ou o que falta nele. O botão só no
               1.º bloco com algo em aberto (o teto é o acumulado). */
            <ul className="mt-3 space-y-2">
              {linhasCaucao.map((l) => (
                <li key={l.id} className="rounded-lg border border-sage-200 px-3 py-2" data-testid="caucao-bloco-linha" data-numero={l.numero}>
                  <p className="text-xs font-medium text-ink" data-testid="caucao-bloco-rotulo">
                    Caução do bloco {l.numero} — {formatBRL(l.caucao)}
                  </p>
                  {l.registro ? (
                    <p className="mt-1 inline-flex items-center gap-2 text-xs text-forest" data-testid="caucao-bloco-status">
                      <Check className="h-3.5 w-3.5" />
                      {l.registro.confirmado
                        ? "Recebimento registrado e confirmado pelo morador."
                        : "Recebimento registrado. Aguardando a confirmação do morador."}
                    </p>
                  ) : l.emAberto > 0 ? (
                    <>
                      {/* PROPOSTA DE TEXTO (E1225) */}
                      <p className="mt-1 text-xs text-muted" data-testid="caucao-bloco-aberto">
                        Em aberto: {formatBRLExato(l.emAberto)}
                      </p>
                      {l.oferecer && (
                        <RegistrarRecebimento
                          tipo="caucao"
                          blocoId={l.id}
                          contratoId={contrato.id}
                          valorSugerido={l.emAberto}
                          hojeISO={hojeISO}
                          demo={demo}
                        />
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted" data-testid="caucao-bloco-nada">
                      {MSG_CAUCAO_NADA_NO_BLOCO}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* E1229 (ORDENS-DUET 1143 e 1160): os registros que o morador ainda não confirmou — o dono pode anular, com o motivo. */}
      {!demo && contrato.pagamentos.some((p) => !p.confirmado) && (
        <ul className="mt-3 space-y-1" data-testid="registros-por-confirmar">
          {contrato.pagamentos
            .filter((p) => !p.confirmado)
            .map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>{p.rotulo} · aguardando a confirmação do morador</span>
                <AnularRegistro pagamentoId={p.id} confirmado={false} />
              </li>
            ))}
        </ul>
      )}

      {/* Timeline dos blocos */}
      <div className="mt-4 space-y-3">
        {contrato.blocos.map((b) => (
          <BlocoRow
            key={b.id}
            bloco={b}
            etapa={contrato.etapa}
            contratoAtivo={contrato.estado.ativo}
            contratoId={contrato.id}
            aluguelMensal={contrato.aluguelMensal}
            prazoTotalDias={contrato.prazoTotalDias}
            pago={pagosPorBloco.get(b.id) ?? somarComponentes([])}
            hojeISO={hojeISO}
            demo={demo}
          />
        ))}
      </div>

      {/* Totais do período */}
      <div className="mt-4 flex flex-wrap gap-4 border-t border-sage-200 pt-3 text-xs text-muted">
        <span>
          Total do período: <strong className="text-ink">{formatBRL(totalPeriodo)}</strong>
        </span>
      </div>

      {extra && (extra.falhou ? (
          <AvisoDocumentosFalhou />
        ) : (
        <>
          <DevolucaoCaucaoDono
            contratoId={contrato.id}
            encerrado={(STATUS_CONTRATO_ENCERRADO as readonly string[]).includes(contrato.status)}
            caucaoConfirmada={extra.caucaoConfirmada}
            acerto={extra.acerto}
            hojeISO={hojeISO}
          />
          <ListaDocumentos documentos={extra.documentos} recibos={extra.recibos} anular />
        </>
      ))}

      {/* Avaliar o inquilino (reputação bidirecional). E346: âncora do e-mail "Avaliar a estadia". */}
      <div id={ancoraAvaliacao(contrato.id)} className="scroll-mt-24">
      <AvaliacaoForm
        contratoId={contrato.id}
        alvoId={contrato.tenantId}
        papelAutor="proprietario"
        abrirLabel="Avaliar o morador"
        titulo="Como foi a locação com este morador?"
        placeholder="Comentário (opcional) — pontualidade, cuidado com o imóvel, comunicação…"
        demo={demo}
        encerradoEm={contrato.fimParaAvaliacao}
        // E544: só dentro da janela (contrato encerrado, até 14 dias depois); antes, o pendente com o prazo.
        fechada={!demo && !contrato.podeAvaliar}
        // E719: o estado real da minha avaliação (publicada tira o "aguardando").
        minhaAvaliacao={demo ? null : contrato.minhaAvaliacao}
      />
      </div>
    </Panel>
  );
}

function BlocoRow({
  bloco,
  etapa,
  contratoAtivo,
  contratoId,
  aluguelMensal,
  prazoTotalDias,
  pago,
  hojeISO,
  demo,
}: {
  bloco: BlocoView;
  etapa: EtapaContrato;
  contratoAtivo: boolean;
  contratoId: string;
  aluguelMensal: number;
  /** E1067 (fusão): o prazo do contrato — o selo do bloco diz dias exactamente quando o contrato é contado em dias. */
  prazoTotalDias: number;
  pago: ComponentesBloco;
  hojeISO: string;
  demo: boolean;
}) {
  const meta = rotuloDoBloco(bloco.status, etapa, contratoAtivo);
  const vigente = contratoAtivo && bloco.inicio <= hojeISO && bloco.fim >= hojeISO;
  // E1072: o bloco custa o que o contrato diz (aluguel + contas do período + limpeza de preparação) e só fica
  // quitado quando os três componentes estão registrados.
  const esperado: ComponentesBloco = bloco.componentes ?? { aluguel: bloco.valor, contas: 0, limpeza: 0, total: bloco.valor };
  const aberto = emAbertoNoBloco(esperado, pago);
  const quitado = aberto.quitado;
  const contaDoBloco = textoComponentes(esperado);
  const faltaTexto = [aberto.aluguel > 0 ? `valor do bloco ${formatBRLExato(aberto.aluguel)}` : "", aberto.contas > 0 ? `${ROTULO_CONTAS.toLowerCase()} ${formatBRLExato(aberto.contas)}` : "", aberto.limpeza > 0 ? `${ROTULO_LIMPEZA.toLowerCase()} ${formatBRLExato(aberto.limpeza)}` : ""].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        vigente ? "border-forest/40 bg-sage-100/40" : "border-sage-200"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-xs font-semibold text-white">
            {bloco.numeroBloco}
          </span>
          <div className="text-sm">
            <p className="font-medium text-ink">
              Bloco {bloco.numeroBloco}{" "}
              {/* E1067: a duração pelos dias reais do bloco ("31 dias"), não pelos meses de referência. */}
              <span className="font-normal text-muted" data-testid="bloco-duracao">({duracaoDoBloco({ numero: bloco.numeroBloco, meses: bloco.meses, inicio: bloco.inicio, fim: bloco.fim }, prazoTotalDias).curto})</span>
            </p>
            <p className="text-xs text-muted">
              {/* E1089: `bloco.fim` é a última noite do bloco; a tela mostra a saída (o dia seguinte). */}
              {formatDate(bloco.inicio)} → {formatDate(saidaPeloFim(bloco.fim) || bloco.fim)}
            </p>
          </div>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", meta.tone)}>
          {meta.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">Valor do bloco</p>
          <p className="font-medium text-ink">{formatBRLExato(bloco.valor)}</p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">{ROTULO_MENSAL}</p>
          <p className="font-medium text-ink">{formatBRL(aluguelMensal)}</p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">Recebido (declarado)</p>
          <p className={cn("font-medium", quitado ? "text-forest" : "text-ink")} data-testid="bloco-recebido">
            {formatBRLExato(pago.total)}{" "}
            {quitado && <Check className="inline h-3.5 w-3.5" />}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">Em aberto</p>
          <p className={cn("font-medium", quitado ? "text-forest" : "text-ink")} data-testid="bloco-em-aberto">
            {formatBRLExato(aberto.total)}
          </p>
        </div>
      </div>
      {contaDoBloco && (
        <p className="mt-2 text-xs text-muted" data-testid="bloco-componentes">
          Pagamento deste bloco, pelo contrato: {contaDoBloco}.
        </p>
      )}

      {/* Registro declaratório de recebimento (só em blocos já iniciados). */}
      {bloco.status !== "agendado" ? (
        quitado ? (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-forest">
            <Check className="h-3.5 w-3.5" /> Valor do bloco registrado como recebido.
          </p>
        ) : pago.total > 0 ? (
          // Já há um registro neste bloco e ainda falta parte: o que falta fica à vista, com o registro COMPLEMENTAR
          // do mesmo bloco (E1072, fatia 2) — o seu recibo e a sua confirmação do morador.
          <>
            <p className="mt-3 text-xs text-amber-800" role="status" data-testid="bloco-falta-registrar">
              Falta registrar {formatBRLExato(aberto.total)} deste bloco ({faltaTexto}).
            </p>
            <RegistrarRecebimento
              tipo="aluguel"
              complemento
              blocoId={bloco.id}
              contratoId={contratoId}
              valorSugerido={aberto.aluguel}
              contasSugeridas={aberto.contas}
              limpezaSugerida={aberto.limpeza}
              hojeISO={hojeISO}
              demo={demo}
            />
          </>
        ) : (
          <RegistrarRecebimento
            tipo="aluguel"
            blocoId={bloco.id}
            contratoId={contratoId}
            valorSugerido={aberto.aluguel > 0 ? aberto.aluguel : aluguelMensal}
            contasSugeridas={aberto.contas}
            limpezaSugerida={aberto.limpeza}
            hojeISO={hojeISO}
            demo={demo}
          />
        )
      ) : (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted">
          <Clock className="h-3.5 w-3.5" /> Bloco agendado — o registro abre quando ele entra em
          vigência.
        </p>
      )}
    </div>
  );
}

/**
 * Registro declaratório de um recebimento: o valor mensal de um BLOCO, ou a Caução do CONTRATO (sem bloco).
 * Sem repetição (complemento do #884): o envio trava na hora do 1º clique (ref, antes do re-render), o botão fica
 * desabilitado enquanto envia e o formulário fecha depois do sucesso. O banco tem o índice único de reserva.
 */
function RegistrarRecebimento({
  tipo,
  blocoId,
  contratoId,
  valorSugerido,
  contasSugeridas = 0,
  limpezaSugerida = 0,
  complemento = false,
  hojeISO,
  demo,
}: {
  /** E1072 (fatia 2): registro complementar de um bloco que já tem registro — só o que falta. */
  complemento?: boolean;
  tipo: "aluguel" | "caucao";
  blocoId: string | null;
  contratoId: string;
  valorSugerido: number;
  /** E1072: as contas do período e a limpeza de preparação que o contrato diz para este bloco (0 = não se aplica). */
  contasSugeridas?: number;
  limpezaSugerida?: number;
  hojeISO: string;
  demo: boolean;
}) {
  const router = useRouter();
  const enviando = useRef(false);
  const [open, setOpen] = useState(false);
  const [jaRegistrado, setJaRegistrado] = useState<string | null>(null);
  const [valor, setValor] = useState(String(valorSugerido));
  // E1072: os componentes que o contrato diz para o bloco chegam preenchidos; cada um é gravado com o seu rótulo.
  const [contas, setContas] = useState(contasSugeridas > 0 ? String(contasSugeridas) : "");
  const [limpeza, setLimpeza] = useState(limpezaSugerida > 0 ? String(limpezaSugerida) : "");
  const temComponentes = tipo === "aluguel" && (contasSugeridas > 0 || limpezaSugerida > 0);
  // No registro complementar, o campo do aluguel só aparece se ainda faltar aluguel.
  const semAluguel = complemento && !(valorSugerido > 0);
  const totalDoRegistro = Math.round(((Number(valor) || 0) + (Number(contas) || 0) + (Number(limpeza) || 0)) * 100) / 100;
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState(hojeISO);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (enviando.current) return;
    enviando.current = true;
    setSaving(true);
    setErro(null);
    const r = await semQuedaDeRede(marcarPagamentoRecebido({
      blocoId: blocoId ?? "",
      contratoId,
      tipo,
      valor: Number(valor) || 0,
      encargos: tipo === "aluguel" ? encargosDosComponentes({ contas: Number(contas) || 0, limpeza: Number(limpeza) || 0 }) : [],
      forma: forma as "pix" | "boleto" | "transferencia" | "dinheiro" | "outro",
      dataPagamento: data,
      observacao: obs || undefined,
    }));
    setSaving(false);
    if (r.ok) {
      setJaRegistrado(r.jaRegistrado ? (r.mensagem ?? "Este recebimento já foi registrado") : null);
      setOpen(false);
      setDone(true);
      // Registro que já existia: a mensagem fica na tela (recarregar trocaria o formulário pelo estado do bloco
      // antes de a pessoa ler "Este recebimento já foi registrado").
      if (!r.jaRegistrado) router.refresh();
    } else {
      enviando.current = false;
      setErro(r.error ?? "Não foi possível registrar.");
    }
  }

  if (done) {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-xs text-forest" role="status" data-testid="recebimento-registrado">
        <Check className="h-3.5 w-3.5" />
        {jaRegistrado
          ? jaRegistrado
          : demo
          ? "Registro de exemplo — em produção fica no histórico do contrato."
          : tipo === "caucao"
            ? "Caução registrada. Quando o morador confirmar, sai o comprovante da caução."
            : "Recebimento registrado. Quando o morador confirmar, o recibo em PDF fica disponível aqui e vai por e-mail para vocês dois."}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sage-200 px-3 py-2 text-xs font-medium text-forest hover:bg-sage-100"
        data-testid={tipo === "caucao" ? "registrar-caucao" : "registrar-recebimento"}
      >
        <Plus className="h-3.5 w-3.5" /> {tipo === "caucao" ? "Registrar recebimento da Caução" : complemento ? "Registrar o que falta" : "Registrar recebimento"}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-sage-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink">
        <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Registrar recebimento (você declara; a plataforma só registra)
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {!semAluguel && (
          <label className="text-xs text-muted">
            {tipo === "caucao" ? "Valor da Caução" : complemento ? "Valor do bloco que falta" : "Valor do bloco"}
            <CampoReais
              semPrefixo
              centavos
              value={valor === "" ? null : Number(valor)}
              onChange={(v) => setValor(v == null ? "" : String(v))}
              className="mt-1 w-full rounded-lg border border-sage-200 px-2 py-2 text-sm text-ink outline-none focus:border-sage"
            />
          </label>
        )}
        <label className="text-xs text-muted">
          Forma
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-200 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-sage"
          >
            {Object.entries(FORMA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Data
          <CampoData
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-200 px-2 py-2 text-sm text-ink outline-none focus:border-sage"
          />
        </label>
      </div>
      {temComponentes && (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(
              [
                [ROTULO_CONTAS, contas, setContas, contasSugeridas, "registrar-contas"],
                [ROTULO_LIMPEZA, limpeza, setLimpeza, limpezaSugerida, "registrar-limpeza"],
              ] as const
            )
              .filter(([, , , sugerido]) => sugerido > 0)
              .map(([rotulo, v, set, , testid]) => (
                <label key={rotulo} className="text-xs text-muted">
                  {rotulo}
                  <CampoReais
                    semPrefixo
                    centavos
                    value={v === "" ? null : Number(v)}
                    onChange={(n) => set(n == null ? "" : String(n))}
                    placeholder="0"
                    testid={testid}
                    className="mt-1 w-full rounded-lg border border-sage-200 px-2 py-2 text-sm text-ink outline-none focus:border-sage"
                  />
                </label>
              ))}
          </div>
          <p className="mt-2 text-xs font-medium text-ink" data-testid="registrar-total">
            Total deste registro: {formatBRLExato(totalDoRegistro)}
          </p>
        </>
      )}
      <input
        type="text"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observação (opcional)"
        className="mt-2 w-full rounded-lg border border-sage-200 px-2 py-2 text-sm text-ink outline-none focus:border-sage"
      />
      <p className="mt-2 text-[11px] text-muted">{REGRA_PAGAMENTO}</p>
      {erro && <p className="mt-2 text-xs text-red-600" data-testid="registrar-erro">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="gold" size="sm" onClick={salvar} disabled={saving} data-testid="confirmar-recebimento">
          {saving ? "Registrando…" : "Confirmar recebimento"}
        </Button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}
