/*
  "Viva rodando automático" (prompt 38) — regras PURAS: que pedidos do 31b cada evento da estadia gera.

  A Viva só conecta. Cada disparo vira um pedido normal do 31b (origem "automatico", taxa de 10%, pagamento pela regra
  do 31b) e o parceiro aceita ou recusa como qualquer pedido. Nada é contratado sem regra do dono: o padrão é "pedir
  minha confirmação"; o automático é escolha do dono por imóvel e categoria. Morador só recebe SUGESTÃO, nunca pedido.
*/
import { horarioNaAgenda, HORARIOS_MAX, type BloqueioAgenda, type JanelaAgenda } from "../parceiros/pedido.ts";

export const CATEGORIAS_VINCULO = ["limpeza", "manutencao", "lavanderia", "fotografia"] as const;
export type CategoriaVinculo = (typeof CATEGORIAS_VINCULO)[number];
export type ModoVinculo = "confirmar" | "automatico";
export type StatusVinculo = "pendente" | "ativo" | "recusado" | "encerrado";
export type Gatilho = "saida_limpeza" | "saida_lavanderia" | "reparo_manutencao";

export const ROTULO_GATILHO: Record<Gatilho, string> = {
  saida_limpeza: "Limpeza na saída",
  saida_lavanderia: "Lavanderia na saída",
  reparo_manutencao: "Reparo depois da conferência",
};

/** A limpeza (e a lavanderia) é pedida/avisada 5 dias antes da saída; as sugestões ao morador, 7 dias antes. */
export const DIAS_ANTES_LIMPEZA = 5;
export const DIAS_ANTES_SUGESTAO = 7;
/** A janela da limpeza começa 2 h depois da saída e vai até a próxima entrada, ou 48 h. */
export const HORAS_DEPOIS_SAIDA = 2;
export const HORAS_JANELA = 48;
/** Parceiro sem resposta em 24 h: o dono é avisado e pode trocar com 1 toque. */
export const HORAS_SEM_RESPOSTA = 24;

export interface Vinculo {
  id: string;
  categoria: CategoriaVinculo;
  parceiroId: string;
  servicoId: string | null;
  modo: ModoVinculo;
  status: StatusVinculo;
  instrucoes?: string | null;
}

export interface ContratoDoEvento {
  id: string;
  propertyId: string;
  /** Último dia da estadia (yyyy-mm-dd) e horário de saída do anúncio ("11:00"). */
  saida: string;
  checkoutBefore?: string | null;
  /** Próxima entrada no mesmo imóvel (outro contrato), se houver. */
  proximaEntrada?: { data: string; checkinAfter?: string | null } | null;
}

export interface ItemReparo {
  comodo: string;
  descricao: string;
  fotos: string[];
}

export type Evento =
  | { tipo: "saida_em_5_dias" }
  | { tipo: "conferencia_saida_fechada"; itensReparo: ItemReparo[] }
  | { tipo: "estadia_remarcada" }
  | { tipo: "contrato_encerrado" }
  | { tipo: "entrada_em_7_dias" }
  | { tipo: "saida_em_7_dias" };

export interface Janela {
  inicio: string;
  fim: string;
  /** A próxima entrada encurta a janela: "nova entrada em [data/hora]: concluir até lá". */
  novaEntrada: string | null;
}

export type Acao =
  | {
      tipo: "criar";
      categoria: CategoriaVinculo;
      gatilho: Gatilho;
      vinculoId: string;
      parceiroId: string;
      servicoId: string | null;
      /** Modo "confirmar": o pedido espera o 1 toque do dono antes de ir ao parceiro. */
      aguardandoDono: boolean;
      chave: string;
      janela: Janela | null;
      descricao: string;
    }
  | { tipo: "atualizar"; chave: string; janela: Janela; descricao: string }
  | { tipo: "cancelar_automaticos"; contratoId: string }
  | { tipo: "avisar_dono_sem_vinculo"; categoria: "limpeza" }
  | { tipo: "sugerir_morador"; momento: "entrada" | "saida"; categorias: ("mudanca" | "limpeza")[] };

/** Chave de idempotência: um pedido por (imóvel, categoria, contrato, evento). A remarcação usa a mesma chave. */
export function chaveAutomacao(propertyId: string, categoria: CategoriaVinculo, contratoId: string, evento: "saida" | "reparo"): string {
  return `${propertyId}:${categoria}:${contratoId}:${evento}`;
}

const BRT = "-03:00";
const hora = (h: string | null | undefined, padrao: string) => (h && /^\d{2}:\d{2}$/.test(h) ? h : padrao);
const mais = (iso: string, horas: number) => new Date(Date.parse(iso) + horas * 3_600_000).toISOString();

/** Data e hora de Brasília, curta: "12/11 às 14:00". */
export function quandoBrasilia(iso: string): string {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}/${v("month")} às ${v("hour")}:${v("minute")}`;
}

/** Janela da limpeza: saída + 2 h até a próxima entrada (se antes) ou + 48 h. */
export function janelaDaLimpeza(c: ContratoDoEvento): Janela {
  const saida = new Date(`${c.saida}T${hora(c.checkoutBefore, "11:00")}:00${BRT}`).toISOString();
  const inicio = mais(saida, HORAS_DEPOIS_SAIDA);
  const padrao = mais(saida, HORAS_JANELA);
  const prox = c.proximaEntrada ? new Date(`${c.proximaEntrada.data}T${hora(c.proximaEntrada.checkinAfter, "14:00")}:00${BRT}`).toISOString() : null;
  if (prox && Date.parse(prox) < Date.parse(padrao)) return { inicio, fim: prox, novaEntrada: prox };
  return { inicio, fim: padrao, novaEntrada: null };
}

function descricaoLimpeza(categoria: "limpeza" | "lavanderia", j: Janela, instrucoes?: string | null): string {
  const o = categoria === "limpeza" ? "Limpeza depois da saída do morador" : "Lavanderia e enxoval depois da saída do morador";
  const partes = [`${o}: entre ${quandoBrasilia(j.inicio)} e ${quandoBrasilia(j.fim)}.`];
  if (j.novaEntrada) partes.push(`Nova entrada em ${quandoBrasilia(j.novaEntrada)}: concluir até lá.`);
  if (instrucoes?.trim()) partes.push(`Instruções do proprietário: ${instrucoes.trim()}`);
  return partes.join(" ");
}

function descricaoReparo(itens: ItemReparo[], instrucoes?: string | null): string {
  const linhas = itens.map((i) => `- ${i.comodo}: ${i.descricao}${i.fotos.length ? ` (${i.fotos.length} foto${i.fotos.length > 1 ? "s" : ""})` : ""}`);
  return [`Reparos apontados na conferência de saída:`, ...linhas, ...(instrucoes?.trim() ? [`Instruções do proprietário: ${instrucoes.trim()}`] : [])].join("\n");
}

const ativo = (vinculos: Vinculo[], cat: CategoriaVinculo) => vinculos.find((v) => v.categoria === cat && v.status === "ativo") ?? null;

/** O que um evento da estadia gera. Só vínculo ATIVO dispara; morador só recebe sugestão. */
export function pedidosDoEvento(evento: Evento, vinculos: Vinculo[], c: ContratoDoEvento): Acao[] {
  switch (evento.tipo) {
    case "saida_em_5_dias": {
      const j = janelaDaLimpeza(c);
      const acoes: Acao[] = [];
      for (const [cat, gatilho] of [["limpeza", "saida_limpeza"], ["lavanderia", "saida_lavanderia"]] as const) {
        const v = ativo(vinculos, cat);
        if (!v) continue;
        acoes.push({
          tipo: "criar",
          categoria: cat,
          gatilho,
          vinculoId: v.id,
          parceiroId: v.parceiroId,
          servicoId: v.servicoId,
          aguardandoDono: v.modo === "confirmar",
          chave: chaveAutomacao(c.propertyId, cat, c.id, "saida"),
          janela: j,
          descricao: descricaoLimpeza(cat, j, v.instrucoes),
        });
      }
      if (!ativo(vinculos, "limpeza")) acoes.push({ tipo: "avisar_dono_sem_vinculo", categoria: "limpeza" });
      return acoes;
    }
    case "conferencia_saida_fechada": {
      const v = ativo(vinculos, "manutencao");
      if (!v || evento.itensReparo.length === 0) return [];
      // Manutenção: sempre "confirmar" (o custo varia), mesmo com o vínculo em automático.
      return [
        {
          tipo: "criar",
          categoria: "manutencao",
          gatilho: "reparo_manutencao",
          vinculoId: v.id,
          parceiroId: v.parceiroId,
          servicoId: v.servicoId,
          aguardandoDono: true,
          chave: chaveAutomacao(c.propertyId, "manutencao", c.id, "reparo"),
          janela: null,
          descricao: descricaoReparo(evento.itensReparo, v.instrucoes),
        },
      ];
    }
    case "estadia_remarcada": {
      const j = janelaDaLimpeza(c);
      return (["limpeza", "lavanderia"] as const)
        .filter((cat) => ativo(vinculos, cat))
        .map((cat) => ({
          tipo: "atualizar" as const,
          chave: chaveAutomacao(c.propertyId, cat, c.id, "saida"),
          janela: j,
          descricao: descricaoLimpeza(cat, j, ativo(vinculos, cat)?.instrucoes),
        }));
    }
    case "contrato_encerrado":
      return [{ tipo: "cancelar_automaticos", contratoId: c.id }];
    case "entrada_em_7_dias":
      return [{ tipo: "sugerir_morador", momento: "entrada", categorias: ["mudanca", "limpeza"] }];
    case "saida_em_7_dias":
      return [{ tipo: "sugerir_morador", momento: "saida", categorias: ["mudanca"] }];
  }
}

/** Status do 31b em que o pedido automático ainda pode ser cancelado/atualizado (o parceiro não aceitou). */
export const STATUS_NAO_ACEITOS = ["solicitado", "orcado"] as const;

/** Até 3 horários dentro da janela que caibam na agenda do parceiro; se nenhum couber, o início da janela, marcado. */
export function horariosNaJanela(
  j: Janela,
  agenda: { janelas: JanelaAgenda[]; bloqueios: BloqueioAgenda[] },
  agora: Date,
): { horarios: string[]; foraDaAgenda: boolean } {
  const out: string[] = [];
  const passo = 3_600_000;
  const inicio = Math.ceil(Date.parse(j.inicio) / passo) * passo;
  for (let t = inicio; t < Date.parse(j.fim) && out.length < HORARIOS_MAX; t += 2 * passo) {
    const iso = new Date(t).toISOString();
    if (horarioNaAgenda(iso, agenda.janelas, agenda.bloqueios, agora)) out.push(iso);
  }
  return out.length ? { horarios: out, foraDaAgenda: false } : { horarios: [new Date(Date.parse(j.inicio)).toISOString()], foraDaAgenda: true };
}

/** Horário de silêncio (22h–7h de Brasília): avisos do 38 não vão por push nesse intervalo (regra única do 44). */
export { emSilencio } from "../notifications/silencio.ts";

/** Pedido automático parado em "solicitado" há 24 h ou mais (o dono é avisado uma vez). */
export function semResposta(criadoEm: string, status: string, agora: Date): boolean {
  return status === "solicitado" && agora.getTime() - Date.parse(criadoEm) >= HORAS_SEM_RESPOSTA * 3_600_000;
}

/** Cartão do morador "Precisa de ajuda com a mudança?": só nos 7 dias antes da entrada e nos 7 antes da saída. */
export function momentoDaSugestao(p: { inicio: string | null; fim: string | null }, hoje: string): "entrada" | "saida" | null {
  const dias = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  if (p.inicio && dias(p.inicio) >= 0 && dias(p.inicio) <= DIAS_ANTES_SUGESTAO) return "entrada";
  if (p.fim && dias(p.fim) >= 0 && dias(p.fim) <= DIAS_ANTES_SUGESTAO) return "saida";
  return null;
}

/** Admin: pedidos automáticos por gatilho, sem contas de teste. */
export function contarPorGatilho(pedidos: { origem: string; gatilho: string | null; teste: boolean }[]): Record<Gatilho, number> {
  const out: Record<Gatilho, number> = { saida_limpeza: 0, saida_lavanderia: 0, reparo_manutencao: 0 };
  for (const p of pedidos) if (p.origem === "automatico" && !p.teste && p.gatilho && p.gatilho in out) out[p.gatilho as Gatilho] += 1;
  return out;
}
