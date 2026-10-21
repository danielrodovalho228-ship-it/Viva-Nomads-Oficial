/*
  Página da estadia (Prompt 32, item 1) — regras puras, sem banco.
  A mesma URL para o dono e o morador (/dashboard/estadia/[contratoId]); cada papel vê a própria visão.
  Datas no calendário de Brasília: o "hoje" sai de diaBRT(agora), nunca do dia em UTC. Entrada e saída usam a
  mesma fonte dos blocos (periodoDosBlocos) e o mesmo horário do imóvel que o prazo da conferência de entrada.
*/
import { diasInclusivos, periodoDosBlocos } from "../contrato-blocos.ts";
import { prazoConferenciaEntrada, textoPrazoConferencia } from "../conferencia.ts";
import { diaBRT } from "../datas-brasilia.ts";
import { rotuloTaxaServico } from "../cobranca/regra.ts";

export type PapelEstadia = "proprietario" | "inquilino";

export const HREF_ESTADIA = (contratoId: string): string => `/dashboard/estadia/${contratoId}`;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "13/11" a partir de AAAA-MM-DD (sem fuso: a data já é do calendário). */
export function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** "13/11/2026" a partir de AAAA-MM-DD. */
export function ddmmaaaa(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Dias corridos de `de` até `ate` (AAAA-MM-DD), negativo se `ate` já passou. */
export function diasAte(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export interface PeriodoEstadia {
  inicio: string | null;
  fim: string | null;
  /** "14:00" do imóvel; vazio = sem horário. */
  checkinAfter?: string | null;
  checkoutBefore?: string | null;
}

export function periodoDaEstadia(
  blocos: { inicio?: string | null; fim?: string | null }[],
  imovel: { checkin_after?: string | null; checkout_before?: string | null } | null,
): PeriodoEstadia {
  const p = periodoDosBlocos(blocos);
  return { ...p, checkinAfter: imovel?.checkin_after ?? null, checkoutBefore: imovel?.checkout_before ?? null };
}

/** "Entrada: 13/11/2026 a partir das 14:00" / "Saída: 15/02/2027 até as 11:00" (sem horário: só a data). */
export function textoEntrada(p: PeriodoEstadia): string {
  if (!p.inicio) return "Entrada: a definir";
  const h = (p.checkinAfter ?? "").trim();
  return `Entrada: ${ddmmaaaa(p.inicio)}${HORA.test(h) ? ` a partir das ${h}` : ""}`;
}
export function textoSaida(p: PeriodoEstadia): string {
  if (!p.fim) return "Saída: a definir";
  const h = (p.checkoutBefore ?? "").trim();
  return `Saída: ${ddmmaaaa(p.fim)}${HORA.test(h) ? ` até as ${h}` : ""}`;
}

/** Status do contrato que encerram a estadia (fora "ativo"). */
const ENCERRADOS = new Set(["concluido", "encerrado_sem_renovacao", "encerrado_em_acerto", "cancelado"]);

export type FaseEstadia = "antes" | "durante" | "encerrada";

export interface TopoEstadia {
  fase: FaseEstadia;
  /** 'Entrada em N dias' / 'Estadia em andamento · faltam N dias' / 'Encerrada em [data]'. */
  texto: string;
  dias: number | null;
}

/** O topo da página, sempre no calendário de Brasília. */
export function topoDaEstadia(
  p: PeriodoEstadia,
  contrato: { status?: string | null; encerrado_em?: string | null },
  agora: Date = new Date(),
): TopoEstadia {
  const hoje = diaBRT(agora) ?? new Date().toISOString().slice(0, 10);
  const status = contrato.status ?? "ativo";
  if (ENCERRADOS.has(status) || (p.fim && diasAte(hoje, p.fim) < 0)) {
    const dia = (contrato.encerrado_em ? diaBRT(contrato.encerrado_em) : null) ?? p.fim;
    return { fase: "encerrada", texto: dia ? `Encerrada em ${ddmmaaaa(dia)}` : "Encerrada", dias: null };
  }
  if (!p.inicio) return { fase: "antes", texto: "Entrada a definir", dias: null };
  const ate = diasAte(hoje, p.inicio);
  if (ate > 0) return { fase: "antes", texto: ate === 1 ? "Entrada amanhã" : `Entrada em ${ate} dias`, dias: ate };
  if (ate === 0) return { fase: "antes", texto: "Entrada hoje", dias: 0 };
  const faltam = p.fim ? diasAte(hoje, p.fim) : null;
  if (faltam == null) return { fase: "durante", texto: "Estadia em andamento", dias: null };
  return {
    fase: "durante",
    texto: faltam === 0 ? "Estadia em andamento · último dia" : `Estadia em andamento · faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`,
    dias: faltam,
  };
}

// ── Checklist antes da entrada ─────────────────────────────────────────────────────────────────────────────────
export type ChaveChecklist = "assinatura" | "primeiro_pagamento" | "caucao" | "conferencia" | "ocupantes" | "instrucoes";

export interface ItemChecklist {
  chave: ChaveChecklist;
  rotulo: string;
  feito: boolean;
  detalhe: string;
}

export interface EstadoChecklist {
  assinadoProprietario: boolean;
  assinadoInquilino: boolean;
  primeiroPagamento: boolean;
  /** "pendente" | "recebida" | "dispensada" — a Caução do 1º bloco (garantia caução); seguro-fiança = "dispensada". */
  caucao: "pendente" | "recebida" | "dispensada";
  conferencia: { estado: "em_andamento" | "aguardando_outra_parte" | "confirmada" | "contestada" | null; prazo: Date | null };
  ocupantes: { preenchidos: number; previstos: number };
  instrucoesPublicadas: boolean;
}

/** O estado real do banco, item a item. As instruções só aparecem na visão do dono. */
export function checklistAntesDaEntrada(e: EstadoChecklist, papel: PapelEstadia): ItemChecklist[] {
  const ambos = e.assinadoProprietario && e.assinadoInquilino;
  const falta = !ambos
    ? !e.assinadoProprietario && !e.assinadoInquilino
      ? "Falta a assinatura das duas partes."
      : `Falta a assinatura ${e.assinadoProprietario ? "do morador" : "do proprietário"}.`
    : "Assinado pelas duas partes.";
  const conf = e.conferencia;
  const rotConf: Record<string, string> = {
    em_andamento: "Em andamento",
    aguardando_outra_parte: "Aguardando a outra parte",
    confirmada: "Confirmada pelas duas partes",
    contestada: "Contestada",
  };
  const itens: ItemChecklist[] = [
    { chave: "assinatura", rotulo: "Contrato assinado", feito: ambos, detalhe: falta },
    {
      chave: "primeiro_pagamento",
      rotulo: "1º pagamento",
      feito: e.primeiroPagamento,
      detalhe: e.primeiroPagamento ? "Registrado e confirmado." : "Ainda não registrado e confirmado.",
    },
    {
      chave: "caucao",
      rotulo: "Caução",
      feito: e.caucao !== "pendente",
      detalhe: e.caucao === "recebida" ? "Recebida pelo proprietário." : e.caucao === "dispensada" ? "Não se aplica a este contrato." : "Ainda não registrada.",
    },
    {
      chave: "conferencia",
      rotulo: "Conferência de entrada",
      feito: conf.estado === "confirmada",
      detalhe: [conf.estado ? rotConf[conf.estado] : "Ainda não começou", conf.prazo ? textoPrazoConferencia(conf.prazo) : ""].filter(Boolean).join(" · "),
    },
    {
      chave: "ocupantes",
      rotulo: "Ocupantes",
      feito: e.ocupantes.preenchidos >= e.ocupantes.previstos && e.ocupantes.previstos > 0,
      detalhe: `${e.ocupantes.preenchidos} de ${e.ocupantes.previstos} preenchidos.`,
    },
  ];
  if (papel === "proprietario") {
    itens.push({
      chave: "instrucoes",
      rotulo: "Instruções de chegada",
      feito: e.instrucoesPublicadas,
      detalhe: e.instrucoesPublicadas ? "Publicadas." : "Ainda não preenchidas.",
    });
  }
  return itens;
}

/** O prazo da conferência de entrada da página: a mesma função do 35B. */
export function prazoDaConferencia(p: PeriodoEstadia): Date | null {
  return prazoConferenciaEntrada({ inicio: p.inicio, checkinAfter: p.checkinAfter });
}

// ── Valores ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const ROTULO_PAGO_DIRETO = "pago direto ao proprietário";

export interface LinhaValor {
  chave: "mensal" | "caucao" | "taxa";
  rotulo: string;
  valor: number;
  detalhe: string;
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Cada valor separado: valor mensal × meses, Caução e (só para o dono) a taxa de serviço com a base escrita.
 * Nunca um "total" que misture a taxa ao valor mensal.
 */
export function valoresDaEstadia(
  v: { valorMensal: number; meses: number; caucao: number; taxa: { percentual: number; valor: number } | null },
  papel: PapelEstadia,
): LinhaValor[] {
  const linhas: LinhaValor[] = [
    {
      chave: "mensal",
      rotulo: "Valor mensal",
      valor: v.valorMensal,
      detalhe: `${brl(v.valorMensal)} × ${v.meses} ${v.meses === 1 ? "mês" : "meses"} · ${ROTULO_PAGO_DIRETO}`,
    },
    { chave: "caucao", rotulo: "Caução", valor: v.caucao, detalhe: v.caucao > 0 ? ROTULO_PAGO_DIRETO : "Não se aplica a este contrato" },
  ];
  if (papel === "proprietario" && v.taxa) {
    linhas.push({ chave: "taxa", rotulo: "Taxa de serviço", valor: v.taxa.valor, detalhe: rotuloTaxaServico(v.taxa.percentual, v.valorMensal, v.meses, v.taxa.valor) });
  }
  return linhas;
}

/** Meses do contrato pelos blocos (dias ÷ 30, arredondado). */
export function mesesDoPeriodo(p: { inicio: string | null; fim: string | null }): number {
  if (!p.inicio || !p.fim) return 0;
  return Math.max(1, Math.round(diasInclusivos(p.inicio, p.fim) / 30));
}

// ── Ações ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface AcaoEstadia {
  id: "mensagem" | "calendario" | "propor_alteracao" | "encerrar" | "ver_contrato";
  rotulo: string;
  href: string;
  primaria: boolean;
}

/** As ações da página: um primário só (regra do 41). Encerrada → só Mensagem e Ver contrato. */
export function acoesDaEstadia(contratoId: string, fase: FaseEstadia, mensagemHref: string, calendarioHref: string): AcaoEstadia[] {
  const base = HREF_ESTADIA(contratoId);
  const lista: AcaoEstadia[] = [
    { id: "mensagem", rotulo: "Mensagem", href: mensagemHref, primaria: true },
    { id: "calendario", rotulo: "Ver no calendário", href: calendarioHref, primaria: false },
    { id: "propor_alteracao", rotulo: "Propor alteração", href: `${base}/alteracao`, primaria: false },
    { id: "encerrar", rotulo: "Encerrar contrato", href: `${base}/encerrar`, primaria: false },
    { id: "ver_contrato", rotulo: "Ver contrato", href: `/dashboard/contratos/${contratoId}`, primaria: false },
  ];
  return fase === "encerrada" ? lista.filter((a) => a.id === "mensagem" || a.id === "ver_contrato") : lista;
}

/**
 * Itens que a folha "Ações desta estadia" (cogumelo, Prompt 41 — componente da Pista A) passa a listar. Só a lista;
 * a Pista A pluga na folha.
 */
export function acoesDaFolhaDaEstadia(contratoId: string, papel: PapelEstadia): { id: string; rotulo: string; href: string }[] {
  const base = HREF_ESTADIA(contratoId);
  return [
    { id: "propor_alteracao_datas", rotulo: "Propor alteração de datas", href: `${base}/alteracao` },
    { id: "instrucoes_chegada", rotulo: "Ver instruções de chegada", href: `${base}#instrucoes` },
    ...(papel === "inquilino" ? [{ id: "pedir_servico", rotulo: "Pedir limpeza/manutenção", href: "/dashboard/servicos" }] : []),
  ];
}
