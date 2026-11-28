/*
  Página da estadia (Prompt 32, item 1) — regras puras, sem banco.
  A mesma URL para o dono e o morador (/dashboard/estadia/[contratoId]); cada papel vê a própria visão.
  Datas no calendário de Brasília: o "hoje" sai de diaBRT(agora), nunca do dia em UTC. Entrada e saída usam a
  mesma fonte dos blocos (periodoDosBlocos) e o mesmo horário do imóvel que o prazo da conferência de entrada.
*/
import { diasInclusivos, periodoDosBlocos } from "../contrato-blocos.ts";
import { prazoConferenciaEntrada, textoPrazoConferencia } from "../conferencia.ts";
import { diaBRT } from "../datas-brasilia.ts";
import { saidaPeloFim } from "../texto-do-periodo.ts";
import { rotuloTaxaServico } from "../cobranca/regra.ts";
import { estadiaEmDias } from "../pagamento-componentes.ts";
// E1067 (fusão, ORDEM-DUET-1155): o dinheiro no formato dos documentos, pela função que os documentos usam.
import { brl } from "../fiscal/documento.ts";

export type PapelEstadia = "proprietario" | "inquilino";

export const HREF_ESTADIA = (contratoId: string): string => `/dashboard/estadia/${contratoId}`;
/** E539 (i): o contrato do morador mora dentro da URL da estadia (o antigo /dashboard/locacoes/<id> redireciona para cá). */
export const HREF_CONTRATO_DA_ESTADIA = (contratoId: string): string => `${HREF_ESTADIA(contratoId)}/contrato`;

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
  /**
   * E1238 (ORDEM-DUET 1207): o prazo de cada conferência, PRONTO do servidor (o gravado quando ela nasceu, ou a mesma
   * regra com a hora das instruções de entrada — periodoComPrazos, data/estadia.ts). A hora do anúncio acima (só para
   * mostrar; o E1230 troca-a) nunca entra no prazo.
   */
  prazoEntradaEm?: string | null;
  prazoSaidaEm?: string | null;
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
/** E1089: `p.fim` é a ÚLTIMA NOITE gravada nos blocos; a SAÍDA que a pessoa lê é o dia seguinte (entrada + dias). */
export function textoSaida(p: PeriodoEstadia): string {
  const saida = saidaPeloFim(p.fim);
  if (!saida) return "Saída: a definir";
  const h = (p.checkoutBefore ?? "").trim();
  return `Saída: ${ddmmaaaa(saida)}${HORA.test(h) ? ` até as ${h}` : ""}`;
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
  // E1089: a estadia acaba no dia da SAÍDA (o dia seguinte à última noite gravada); as contas do topo partem dela.
  const saida = saidaPeloFim(p.fim) || null;
  if (ENCERRADOS.has(status) || (saida && diasAte(hoje, saida) < 0)) {
    const dia = (contrato.encerrado_em ? diaBRT(contrato.encerrado_em) : null) ?? saida;
    return { fase: "encerrada", texto: dia ? `Encerrada em ${ddmmaaaa(dia)}` : "Encerrada", dias: null };
  }
  if (!p.inicio) return { fase: "antes", texto: "Entrada a definir", dias: null };
  const ate = diasAte(hoje, p.inicio);
  if (ate > 0) return { fase: "antes", texto: ate === 1 ? "Entrada amanhã" : `Entrada em ${ate} dias`, dias: ate };
  if (ate === 0) return { fase: "antes", texto: "Entrada hoje", dias: 0 };
  const faltam = saida ? diasAte(hoje, saida) : null;
  if (faltam == null) return { fase: "durante", texto: "Estadia em andamento", dias: null };
  return {
    fase: "durante",
    texto: faltam === 0 ? "Estadia em andamento · saída hoje" : `Estadia em andamento · faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`,
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
  /** ORDEM-DUET-1048: a ação no mesmo item (ex.: o morador confirma o que o dono registrou). */
  acao?: { rotulo: string; href: string };
}

/**
 * PROPOSTA DE TEXTO (ORDEM-DUET-1048, condição do coordenador): ao lado de "Falta a sua confirmação", a ação de
 * confirmar — a confirmação vive em Locações (o bloco "confirmar-pagamentos").
 */
export const ACAO_CONFIRMAR_NO_ITEM = { rotulo: "Confirmar em Locações", href: "/dashboard/locacoes" } as const;

export interface EstadoChecklist {
  assinadoProprietario: boolean;
  assinadoInquilino: boolean;
  primeiroPagamento: boolean;
  /** E1068: o proprietário já registrou o 1º pagamento (com ou sem a confirmação do morador). */
  primeiroPagamentoRegistrado?: boolean;
  /** "pendente" | "recebida" | "dispensada" — a Caução do 1º bloco (garantia caução); seguro-fiança = "dispensada". */
  caucao: "pendente" | "recebida" | "dispensada";
  /** E1068: a caução já foi registrada pelo proprietário e espera a confirmação do morador. */
  caucaoRegistrada?: boolean;
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
  // E1068: o estado do meio — registrado pelo proprietário, à espera do morador — dito para quem lê. Antes a lista só
  // conhecia "confirmado" e "não registrado", e o dono que acabava de registrar continuava a ler "Ainda não registrado".
  const aguardando = (genero: "o" | "a") =>
    papel === "proprietario" ? `Registrad${genero} por você. Aguardando a confirmação do morador.` : `Registrad${genero} pelo proprietário. Falta a sua confirmação.`;
  // ORDEM-DUET-1048: só o morador, no estado do meio, tem o que fazer — a ação de confirmar fica no próprio item.
  const acaoDeConfirmar = (registrado: boolean, confirmado: boolean) =>
    papel !== "proprietario" && registrado && !confirmado ? { acao: { ...ACAO_CONFIRMAR_NO_ITEM } } : {};
  const itens: ItemChecklist[] = [
    { chave: "assinatura", rotulo: "Contrato assinado", feito: ambos, detalhe: falta },
    {
      chave: "primeiro_pagamento",
      rotulo: "1º pagamento",
      feito: e.primeiroPagamento,
      detalhe: e.primeiroPagamento ? "Registrado e confirmado." : e.primeiroPagamentoRegistrado ? aguardando("o") : "Ainda não registrado e confirmado.",
      ...acaoDeConfirmar(!!e.primeiroPagamentoRegistrado, e.primeiroPagamento),
    },
    {
      chave: "caucao",
      rotulo: "Caução",
      feito: e.caucao !== "pendente",
      detalhe:
        e.caucao === "recebida"
          ? "Recebida pelo proprietário."
          : e.caucao === "dispensada"
            ? "Não se aplica a este contrato."
            : e.caucaoRegistrada
              ? aguardando("a")
              : "Ainda não registrada.",
      ...acaoDeConfirmar(!!e.caucaoRegistrada, e.caucao !== "pendente"),
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
  // E1238: o prazo pronto do servidor; sem ele, a regra sem hora (00:00).
  return p.prazoEntradaEm ? new Date(p.prazoEntradaEm) : prazoConferenciaEntrada({ inicio: p.inicio, checkinAfter: null });
}

// ── Valores ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const ROTULO_PAGO_DIRETO = "pago direto ao proprietário";

export interface LinhaValor {
  chave: "mensal" | "caucao" | "taxa";
  rotulo: string;
  valor: number;
  detalhe: string;
}


/**
 * Cada valor separado: valor mensal × meses, Caução e (só para o dono) a taxa de serviço com a base escrita.
 * Nunca um "total" que misture a taxa ao valor mensal.
 */
export function valoresDaEstadia(
  v: { valorMensal: number; meses: number; caucao: number; taxa: { percentual: number; valor: number } | null; /** E1067: dias reais do contrato, quando ele não fecha em meses inteiros. */ dias?: number | null },
  papel: PapelEstadia,
): LinhaValor[] {
  // E1067: contrato em dias quebrados (31, 43…) → "R$ 2.500,00 × 31 dias ÷ 30", a mesma conta do contrato e do e-mail (E562).
  // Fusão (mapa v4, mudança 7): a regra é a da fonte única (sem segunda cópia).
  const emDias = estadiaEmDias(v.dias);
  const linhas: LinhaValor[] = [
    {
      chave: "mensal",
      rotulo: "Valor mensal",
      valor: v.valorMensal,
      detalhe: emDias
        ? `${brl(v.valorMensal)} × ${v.dias} dias ÷ 30 · ${ROTULO_PAGO_DIRETO}`
        : `${brl(v.valorMensal)} × ${v.meses} ${v.meses === 1 ? "mês" : "meses"} · ${ROTULO_PAGO_DIRETO}`,
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

// ── Decisões das estadias (card da home do painel) ─────────────────────────────────────────────────────────────
export interface EntradaDecisoes {
  contratoId: string;
  papel: PapelEstadia;
  fase: FaseEstadia;
  assinadoPelasDuas: boolean;
  ocupantes: { preenchidos: number; previstos: number };
  instrucoesPreenchidas: boolean;
  /** Aditivo aberto (proposto ou aceito), se houver. */
  aditivo: { status: "proposto" | "aceito"; propostoPorMim: boolean; euAssinei: boolean } | null;
}

export interface DecisaoEstadia {
  id: "responder_aditivo" | "assinar_aditivo" | "preencher_ocupantes" | "preencher_instrucoes";
  rotulo: string;
  href: string;
}

/** O que espera esta pessoa nesta estadia — só o que ela mesma decide (nada da outra parte). */
export function decisoesDaEstadia(e: EntradaDecisoes): DecisaoEstadia[] {
  if (e.fase === "encerrada") return [];
  const base = HREF_ESTADIA(e.contratoId);
  const out: DecisaoEstadia[] = [];
  if (e.aditivo?.status === "proposto" && !e.aditivo.propostoPorMim) out.push({ id: "responder_aditivo", rotulo: "Responder à proposta de alteração", href: base });
  if (e.aditivo?.status === "aceito" && !e.aditivo.euAssinei) out.push({ id: "assinar_aditivo", rotulo: "Assinar o aditivo", href: base });
  if (e.papel === "inquilino" && e.assinadoPelasDuas && e.ocupantes.preenchidos < e.ocupantes.previstos) {
    out.push({ id: "preencher_ocupantes", rotulo: "Preencher os ocupantes para a portaria", href: `${base}/ocupantes` });
  }
  if (e.papel === "proprietario" && e.fase === "antes" && !e.instrucoesPreenchidas) {
    out.push({ id: "preencher_instrucoes", rotulo: "Preencher as instruções de chegada", href: `${base}#instrucoes` });
  }
  return out;
}
