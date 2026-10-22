/*
  "Hoje você tem N decisões" (Prompt 42, item 1) — PURO.

  A Visão geral abre com as decisões que esperam a pessoa, montadas SÓ com dados que já existem e com as regras que já
  existem (nada é decidido aqui de novo):
    • proposta → aguardandoVoce (listarPropostas, regra aguardandoResposta das propostas);
    • contrato → estadoDoContratoUnico(...).faltaVoce (fonte única do estado do contrato);
    • visita   → podeTransicionar(status, "confirmado", quem) (regras das visitas);
    • manutenção → prazoDaOrdem (prazo do proprietário; "vencido" = atrasada);
    • estadia  → decisoesDaEstadia (card do Prompt 32, a mesma lista da folha do 41);
    • candidatura nova → leads.status "new" (a mesma de Interessados);
    • documento reprovado → item "documento" da prontidão do rascunho (fonte única do anúncio).
  Cada linha é um LINK para a tela onde a decisão é tomada — nunca se decide aqui.
  Ordem: prazo mais próximo primeiro (vencidos no topo); sem prazo depois; empate pela prioridade do tipo.
  Roda: node --test src/lib/painel/decisoes.test.ts
*/
import { estadoDoContratoUnico, type LinhaEstadoContrato } from "../contrato-estado.ts";
import { podeTransicionar, formatarHorario, type StatusVisita } from "../visitas-video.ts";
import { prazoDaOrdem } from "../manutencao-solicitacoes.ts";
import type { SOPriority, SOStatus } from "../service-orders.ts";
import { textoVencimento } from "../propostas/regras.ts";
import type { DecisaoEstadia } from "../estadia/estadia.ts";
import type { Prontidao } from "../anuncio/prontidao.ts";

export type TipoDecisao =
  | "contrato"
  | "proposta"
  | "manutencao"
  | "estadia"
  | "visita"
  | "documento"
  | "candidatura";

/** Prioridade do tipo no empate (menor = antes). */
export const PRIORIDADE_TIPO: Record<TipoDecisao, number> = {
  contrato: 0,
  proposta: 1,
  manutencao: 2,
  estadia: 3,
  visita: 4,
  documento: 5,
  candidatura: 6,
};

export interface Decisao {
  id: string;
  tipo: TipoDecisao;
  /** Uma linha, com a coisa concreta ("Contraproposta de R$ 3.200 por mês para Studio Centro"). */
  texto: string;
  /** Tela onde a decisão é tomada. */
  href: string;
  /** Prazo (ISO) quando o dado tem um; null quando não tem. */
  prazo: string | null;
  /** Frase curta do prazo ("vence em 3 dias", "responder até …"); null sem prazo. */
  prazoTexto: string | null;
  /** O prazo já passou. */
  atrasada: boolean;
}

export interface PropostaParaDecisao {
  id: string;
  imovel: string;
  valorMensal: number;
  validaAte: string;
  papel: "owner" | "tenant";
  aguardandoVoce: boolean;
}

export interface ContratoParaDecisao extends LinhaEstadoContrato {
  id: string;
  imovel: string;
}

export interface VisitaParaDecisao {
  id: string;
  imovel: string;
  status: StatusVisita;
  modalidade: "video" | "presencial";
  horarios: string[];
  horarioProposto: string | null;
}

export interface ManutencaoParaDecisao {
  id: string;
  imovel: string;
  priority: SOPriority;
  status: SOStatus;
  openedAt: string;
  firstResponseAt?: string | null;
}

export interface EstadiaParaDecisao {
  contratoId: string;
  imovel: string;
  decisoes: DecisaoEstadia[];
}

export interface CandidaturaParaDecisao {
  id: string;
  imovel: string;
  propertyId: string;
  status: string;
}

export interface RascunhoParaDecisao {
  id: string;
  titulo: string;
  prontidao: Prontidao | null;
}

export interface DadosDecisoes {
  propostas?: PropostaParaDecisao[];
  contratos?: ContratoParaDecisao[];
  visitas?: VisitaParaDecisao[];
  manutencoes?: ManutencaoParaDecisao[];
  estadias?: EstadiaParaDecisao[];
  candidaturas?: CandidaturaParaDecisao[];
  rascunho?: RascunhoParaDecisao | null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais = (v: number) => BRL.format(v);
const nomeImovel = (t: string | null | undefined) => (t ?? "").trim() || "seu imóvel";

function comPrazo(prazo: string | null, agora: Date): { prazo: string | null; atrasada: boolean } {
  if (!prazo) return { prazo: null, atrasada: false };
  const t = new Date(prazo).getTime();
  if (!Number.isFinite(t)) return { prazo: null, atrasada: false };
  return { prazo: new Date(t).toISOString(), atrasada: t < agora.getTime() };
}

function propostas(d: DadosDecisoes, papel: "owner" | "tenant", agora: Date): Decisao[] {
  return (d.propostas ?? [])
    .filter((p) => p.papel === papel && p.aguardandoVoce)
    .map((p) => {
      const pz = comPrazo(p.validaAte, agora);
      const valor = Number.isFinite(p.valorMensal) && p.valorMensal > 0 ? ` de ${reais(p.valorMensal)} por mês` : "";
      return {
        id: `proposta-${p.id}`,
        tipo: "proposta" as const,
        texto: `${papel === "owner" ? "Contraproposta" : "Proposta"}${valor} para ${nomeImovel(p.imovel)}`,
        href: `/dashboard/propostas/${p.id}`,
        prazoTexto: pz.prazo ? textoVencimento(pz.prazo, agora) : null,
        ...pz,
      };
    });
}

function contratos(d: DadosDecisoes, papel: "proprietario" | "inquilino"): Decisao[] {
  return (d.contratos ?? [])
    .filter((c) => estadoDoContratoUnico(c, papel).faltaVoce)
    .map((c) => ({
      id: `contrato-${c.id}`,
      tipo: "contrato" as const,
      texto: `Contrato de ${nomeImovel(c.imovel)} aguarda sua assinatura`,
      href: `/dashboard/contratos/${c.id}`,
      prazo: null,
      prazoTexto: null,
      atrasada: false,
    }));
}

function estadias(d: DadosDecisoes): Decisao[] {
  return (d.estadias ?? []).flatMap((e) =>
    e.decisoes.map((x) => ({
      id: `estadia-${e.contratoId}-${x.id}`,
      tipo: "estadia" as const,
      texto: `${x.rotulo} — ${nomeImovel(e.imovel)}`,
      href: x.href,
      prazo: null,
      prazoTexto: null,
      atrasada: false,
    })),
  );
}

/** Decisões do PROPRIETÁRIO (a Visão geral no modo proprietário). */
export function decisoesDoProprietario(d: DadosDecisoes, agora: Date = new Date()): Decisao[] {
  const out: Decisao[] = [...contratos(d, "proprietario"), ...propostas(d, "owner", agora), ...estadias(d)];

  for (const o of d.manutencoes ?? []) {
    const p = prazoDaOrdem({ priority: o.priority, openedAt: o.openedAt, firstResponseAt: o.firstResponseAt ?? undefined, status: o.status }, agora);
    if (p.estado === "respondida") continue;
    const atrasada = p.estado === "vencido";
    out.push({
      id: `manutencao-${o.id}`,
      tipo: "manutencao",
      texto: `${atrasada ? "Manutenção atrasada" : "Manutenção pedida"} em ${nomeImovel(o.imovel)}`,
      href: "/dashboard/solicitacoes",
      prazo: p.ate.toISOString(),
      prazoTexto: p.texto,
      atrasada,
    });
  }

  for (const v of d.visitas ?? []) {
    if (!podeTransicionar(v.status, "confirmado", "dono")) continue;
    const futuros = v.horarios.map((h) => new Date(h).getTime()).filter((t) => Number.isFinite(t) && t > agora.getTime()).sort((a, b) => a - b);
    const primeiro = futuros.length ? new Date(futuros[0]).toISOString() : null;
    out.push({
      id: `visita-${v.id}`,
      tipo: "visita",
      texto: `Pedido de visita ${v.modalidade === "presencial" ? "presencial" : "por vídeo"} para ${nomeImovel(v.imovel)}`,
      href: "/dashboard/visitas",
      prazo: primeiro,
      prazoTexto: primeiro ? `1º horário: ${formatarHorario(primeiro)}` : null,
      atrasada: false,
    });
  }

  const r = d.rascunho;
  const doc = r?.prontidao?.obrigatorios.find((i) => i.key === "documento");
  if (r && doc && !doc.ok && /^reprovado/.test(doc.detalhe ?? "")) {
    out.push({
      id: `documento-${r.id}`,
      tipo: "documento",
      texto: `Documento de ${nomeImovel(r.titulo)} reprovado — envie de novo`,
      href: `/dashboard/imoveis/novo?draft=${encodeURIComponent(r.id)}&etapa=${doc.etapa}`,
      prazo: null,
      prazoTexto: null,
      atrasada: false,
    });
  }

  // Candidaturas novas: uma linha por imóvel (várias no mesmo imóvel viram "3 candidaturas novas").
  const porImovel = new Map<string, { imovel: string; n: number }>();
  for (const c of d.candidaturas ?? []) {
    if (c.status !== "new") continue;
    const atual = porImovel.get(c.propertyId) ?? { imovel: c.imovel, n: 0 };
    porImovel.set(c.propertyId, { imovel: atual.imovel, n: atual.n + 1 });
  }
  for (const [propertyId, { imovel, n }] of porImovel) {
    out.push({
      id: `candidatura-${propertyId}`,
      tipo: "candidatura",
      texto: n === 1 ? `Nova candidatura para ${nomeImovel(imovel)}` : `${n} candidaturas novas para ${nomeImovel(imovel)}`,
      href: "/dashboard/leads",
      prazo: null,
      prazoTexto: null,
      atrasada: false,
    });
  }

  return ordenarDecisoes(out);
}

/** Decisões do MORADOR (a Visão geral no modo inquilino). */
export function decisoesDoMorador(d: DadosDecisoes, agora: Date = new Date()): Decisao[] {
  const out: Decisao[] = [...contratos(d, "inquilino"), ...propostas(d, "tenant", agora), ...estadias(d)];
  for (const v of d.visitas ?? []) {
    if (!podeTransicionar(v.status, "confirmado", "morador")) continue;
    const pz = comPrazo(v.horarioProposto, agora);
    out.push({
      id: `visita-${v.id}`,
      tipo: "visita",
      texto: `Novo horário para a visita em ${nomeImovel(v.imovel)}`,
      href: "/dashboard/visitas",
      prazoTexto: pz.prazo ? `Horário proposto: ${formatarHorario(pz.prazo)}` : null,
      ...pz,
    });
  }
  return ordenarDecisoes(out);
}

/** Prazo mais próximo primeiro (vencidos no topo), sem prazo depois; empate pela prioridade do tipo e pelo texto. */
export function ordenarDecisoes(itens: Decisao[]): Decisao[] {
  const t = (d: Decisao) => (d.prazo ? new Date(d.prazo).getTime() : Number.POSITIVE_INFINITY);
  return [...itens].sort((a, b) => t(a) - t(b) || PRIORIDADE_TIPO[a.tipo] - PRIORIDADE_TIPO[b.tipo] || a.texto.localeCompare(b.texto, "pt-BR"));
}

/** Decisão com o rótulo do papel em que ela é tomada (Prompt 43: o Início junta os papéis ativos). */
export type DecisaoDoPapel = Decisao & { papel: "proprietario" | "morador" };

/**
 * Prompt 43 (conta única): o Início junta as decisões de todos os papéis ativos, cada uma com o rótulo do papel, na
 * mesma ordem de sempre (prazo mais próximo primeiro). Uma decisão que apareça nos dois papéis (mesmo id) entra uma vez.
 */
export function juntarDecisoes(doDono: Decisao[], doMorador: Decisao[]): DecisaoDoPapel[] {
  const vistos = new Set<string>();
  const todas: DecisaoDoPapel[] = [];
  for (const [lista, papel] of [[doDono, "proprietario"], [doMorador, "morador"]] as const) {
    for (const d of lista) {
      if (vistos.has(d.id)) continue;
      vistos.add(d.id);
      todas.push({ ...d, papel });
    }
  }
  return ordenarDecisoes(todas) as DecisaoDoPapel[];
}

/** O título da Visão geral: "Hoje você tem 1 decisão" / "… N decisões" / "Nada pede sua decisão hoje". */
export function tituloDecisoes(n: number): string {
  if (n <= 0) return "Nada pede sua decisão hoje";
  return n === 1 ? "Hoje você tem 1 decisão" : `Hoje você tem ${n} decisões`;
}
