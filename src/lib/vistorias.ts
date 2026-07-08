/**
 * Ciclo de Vistorias e Encerramento (Dossiê Viva) — REGRAS PURAS e testáveis
 * (sem imports de valor; sem I/O). As telas e server actions consomem estas
 * funções; o banco (migração 0036) guarda a prova imutável.
 *
 * Decisões dos sócios embutidas:
 *  - Posse é do inquilino durante a vigência: vistoria de saída só NO ATO da
 *    entrega das chaves, com o imóvel desocupado (podeIniciarVistoriaSaida).
 *  - O silêncio não assina: sem resposta do inquilino, a vistoria fica
 *    'aguardando_confirmacao' para sempre (nunca auto-confirma).
 *  - Regra de ouro: acerto da caução é DECLARATÓRIO (registra, não processa).
 *  - Regra 4.2 (honestidade bilateral): desconto de caução só existe VINCULADO
 *    a um item 'com dano' da vistoria de saída assinada.
 */

export type TipoVistoria = "entrada" | "saida";
export type EstadoItem = "otimo" | "bom" | "avaria"; // vistoria de entrada
export type MarcaSaida = "conforme" | "dano"; // vistoria de saída (vs entrada)
export type StatusVistoria = "rascunho" | "aguardando_confirmacao" | "assinada";

/** Estados do contrato no encerramento (a migração estende o check de status). */
export type StatusContrato =
  | "ativo"
  | "encerrado_em_acerto" // vistoria de saída registrada, aguardando acerto da caução
  | "concluido" // acerto finalizado (devolução ou desconto confirmado/contestado)
  | "encerrado_sem_renovacao"
  | "cancelado";

export type TipoAcerto = "devolucao_integral" | "desconto";
export type StatusAcerto =
  | "devolvida_integral"
  | "desconto_confirmado"
  | "desconto_contestado"
  | "aguardando_confirmacao";

// ── Checklist padrão por cômodo (editável na tela) ───────────────────────────
export interface ComodoPadrao {
  chave: string;
  nome: string;
  itens: string[];
}

export const COMODOS_PADRAO: ComodoPadrao[] = [
  { chave: "sala", nome: "Sala", itens: ["Paredes e pintura", "Piso", "Janelas", "Móveis"] },
  { chave: "cozinha", nome: "Cozinha", itens: ["Bancada e pia", "Armários", "Eletrodomésticos", "Piso"] },
  { chave: "quarto", nome: "Quarto", itens: ["Paredes e pintura", "Piso", "Cama e colchão", "Guarda-roupa"] },
  { chave: "banheiro", nome: "Banheiro", itens: ["Louças", "Box e vidros", "Torneiras", "Piso e rejunte"] },
  { chave: "area_externa", nome: "Área externa", itens: ["Piso", "Portões e grades", "Iluminação"] },
];

/** Monta o checklist inicial (estruturado) a partir do padrão. */
export function montarChecklistPadrao(): { comodo: string; nome: string; item: string }[] {
  return COMODOS_PADRAO.flatMap((c) => c.itens.map((item) => ({ comodo: c.chave, nome: c.nome, item })));
}

// ── Regras de foto por cômodo (mín. 1 por cômodo na vistoria de entrada) ──────
export function comodosSemFoto(
  comodos: string[],
  fotosPorComodo: Record<string, number>
): string[] {
  return comodos.filter((c) => !((fotosPorComodo[c] ?? 0) >= 1));
}

// ── Máquina de estados da VISTORIA ───────────────────────────────────────────
export type EventoVistoria =
  | { tipo: "concluir_executor" } // executor finaliza → vai p/ confirmação do inquilino
  | { tipo: "confirmar_inquilino" } // inquilino confirma item a item → assinada
  | { tipo: "contestar_inquilino" }; // inquilino contesta → segue aguardando (não assina)

/**
 * Transição da vistoria. O silêncio NÃO é evento: sem "confirmar_inquilino" a
 * vistoria fica presa em 'aguardando_confirmacao' (nunca auto-confirma).
 */
export function proximoStatusVistoria(
  atual: StatusVistoria,
  evento: EventoVistoria
): StatusVistoria {
  if (atual === "rascunho" && evento.tipo === "concluir_executor") return "aguardando_confirmacao";
  if (atual === "aguardando_confirmacao" && evento.tipo === "confirmar_inquilino") return "assinada";
  // Contestação mantém em aguardando_confirmacao (executor precisa revisar/reenviar).
  if (atual === "aguardando_confirmacao" && evento.tipo === "contestar_inquilino")
    return "aguardando_confirmacao";
  return atual; // transição inválida = sem efeito (assinada é imutável)
}

/** Uma vistoria assinada é imutável: nenhuma edição depois do selo. */
export function vistoriaEditavel(status: StatusVistoria): boolean {
  return status !== "assinada";
}

// ── Vistoria de saída só no ato da entrega (imóvel desocupado) ────────────────
/**
 * A vistoria de saída só pode iniciar a partir do fim do último bloco (entrega
 * das chaves) — nunca durante a vigência. `hojeISO` e `fimUltimoBlocoISO` em
 * yyyy-mm-dd. Uma folga opcional (dias) cobre a combinação do horário.
 */
export function podeIniciarVistoriaSaida(
  hojeISO: string,
  fimUltimoBlocoISO: string,
  folgaDias = 3
): boolean {
  if (!hojeISO || !fimUltimoBlocoISO) return false;
  const hoje = Date.parse(hojeISO + "T00:00:00Z");
  const fim = Date.parse(fimUltimoBlocoISO + "T00:00:00Z");
  if (Number.isNaN(hoje) || Number.isNaN(fim)) return false;
  const folgaMs = folgaDias * 24 * 60 * 60 * 1000;
  return hoje >= fim - folgaMs;
}

/** D-10: quando notificar o encerramento (10 dias antes do fim, sem renovação). */
export function dispararEncerramentoEmD10(
  hojeISO: string,
  fimUltimoBlocoISO: string,
  temRenovacao: boolean
): boolean {
  if (temRenovacao || !hojeISO || !fimUltimoBlocoISO) return false;
  const hoje = Date.parse(hojeISO + "T00:00:00Z");
  const fim = Date.parse(fimUltimoBlocoISO + "T00:00:00Z");
  if (Number.isNaN(hoje) || Number.isNaN(fim)) return false;
  const dias = Math.round((fim - hoje) / (24 * 60 * 60 * 1000));
  return dias <= 10 && dias >= 0;
}

// ── Máquina de estados do CONTRATO no encerramento ───────────────────────────
export type EventoEncerramento =
  | { tipo: "vistoria_saida_assinada" }
  | { tipo: "acerto_finalizado" };

export function proximoStatusEncerramento(
  atual: StatusContrato,
  evento: EventoEncerramento
): StatusContrato {
  if (atual === "ativo" && evento.tipo === "vistoria_saida_assinada") return "encerrado_em_acerto";
  if (atual === "encerrado_em_acerto" && evento.tipo === "acerto_finalizado") return "concluido";
  return atual;
}

// ── Acerto da caução (declaratório) — REGRA 4.2 ──────────────────────────────
export interface DescontoInput {
  itemDanoId: string; // DEVE apontar para um item 'com dano' da vistoria de saída assinada
  valor: number;
  justificativa: string;
  fotoUrl?: string;
}
export interface AcertoInput {
  tipo: TipoAcerto;
  caucaoTotal: number;
  // devolução integral:
  valorDevolvido?: number;
  data?: string;
  meio?: string;
  // desconto:
  descontos?: DescontoInput[];
}

export interface ValidacaoAcerto {
  ok: boolean;
  error?: string;
  totalDescontos?: number;
  valorRestanteDevolver?: number;
}

/**
 * Valida o acerto SEM processar dinheiro. Regra 4.2: todo desconto tem de estar
 * vinculado a um item de DANO da vistoria de saída ASSINADA (idsDanoValidos).
 */
export function validarAcerto(input: AcertoInput, idsDanoValidos: string[]): ValidacaoAcerto {
  const danoSet = new Set(idsDanoValidos);

  if (input.tipo === "devolucao_integral") {
    if (!(Number(input.valorDevolvido) > 0)) return { ok: false, error: "Informe o valor devolvido." };
    if (!input.data) return { ok: false, error: "Informe a data da devolução." };
    if (!input.meio?.trim()) return { ok: false, error: "Informe o meio (PIX, transferência…)." };
    return { ok: true, totalDescontos: 0, valorRestanteDevolver: Number(input.valorDevolvido) };
  }

  // desconto
  const descontos = input.descontos ?? [];
  if (descontos.length === 0) return { ok: false, error: "Adicione ao menos um desconto." };
  for (const d of descontos) {
    if (!d.itemDanoId || !danoSet.has(d.itemDanoId))
      return { ok: false, error: "Cada desconto deve estar vinculado a um item com dano da vistoria de saída." };
    if (!(Number(d.valor) > 0)) return { ok: false, error: "Cada desconto precisa de um valor." };
    if (!d.justificativa?.trim()) return { ok: false, error: "Cada desconto precisa de justificativa." };
  }
  const total = descontos.reduce((s, d) => s + Number(d.valor), 0);
  if (total > input.caucaoTotal)
    return { ok: false, error: "A soma dos descontos não pode passar da caução." };
  return { ok: true, totalDescontos: total, valorRestanteDevolver: Math.max(0, input.caucaoTotal - total) };
}

// ── Rótulos de status (UI) ───────────────────────────────────────────────────
export function statusVistoriaLabel(s: StatusVistoria): string {
  return {
    rascunho: "Em preenchimento",
    aguardando_confirmacao: "Aguardando confirmação do inquilino",
    assinada: "Assinada pelos dois — selada",
  }[s];
}

export function statusAcertoLabel(s: StatusAcerto): string {
  return {
    aguardando_confirmacao: "Aguardando confirmação",
    devolvida_integral: "Caução devolvida integralmente",
    desconto_confirmado: "Caução com desconto (confirmado)",
    desconto_contestado: "Caução com desconto (contestado)",
  }[s];
}

// ── Dossiê: montagem cronológica (hook p/ export futuro — Fase 5.3) ───────────
export interface EventoDossie {
  quando: string; // ISO
  tipo: string;
  titulo: string;
  hash?: string;
  quem?: string;
}
/** Ordena os eventos do dossiê cronologicamente (base do PDF futuro). */
export function montarDossie(eventos: EventoDossie[]): EventoDossie[] {
  return [...eventos].sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));
}
