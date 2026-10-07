/*
  Central de Agentes — "retrato do momento" (PURO).
  Números fixos que o servidor junta ANTES de chamar o modelo e que vão no
  prompt, com a hora da consulta. Só contagens e status: nenhum nome, e-mail,
  telefone ou endereço. O modelo continua sem ferramentas e sem consulta livre.
*/
import { proximaRonda, type Agente } from "./central.ts";

export interface Retrato {
  /** ISO da consulta. */
  em: string;
  cadastros: { proprietarios: number; inquilinos: number; admins: number; total: number; pareceTeste: number };
  imoveis: { total: number; publicados: number };
  pedidos: { total: number; ultimas24h: number };
  leads: { total: number; ultimas24h: number };
  contratosPorStatus: Record<string, number>;
  chamadosAbertosPorPrioridade: Record<string, number>;
  rondas: { agente: string; status: string; em: string; resumo: string }[];
  ordensPendentes: { agente: string; n: number }[];
  agentes: Pick<Agente, "nome" | "status" | "rotina_texto">[];
}

/** Hora no fuso de Brasília: "07/10 08:15". */
export function horaBrasilia(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

const lista = (o: Record<string, number>) => {
  const itens = Object.entries(o).filter(([, n]) => n > 0);
  return itens.length ? itens.map(([k, n]) => `${k}: ${n}`).join(", ") : "nenhum";
};

/** Texto do retrato para o prompt (curto, sem dado pessoal). */
export function retratoEmTexto(r: Retrato | null): string {
  if (!r) return "RETRATO DO MOMENTO: indisponível agora (falha ao consultar). Diga isso se perguntarem por números.";
  const quando = horaBrasilia(r.em);
  const c = r.cadastros;
  const rondas = r.rondas.length
    ? r.rondas.map((x) => `  • ${horaBrasilia(x.em)} — ${x.agente} (${x.status}): ${x.resumo.replace(/\s+/g, " ").slice(0, 200)}`).join("\n")
    : "  • nenhuma ronda registrada na Central ainda";
  const ordens = r.ordensPendentes.length ? r.ordensPendentes.map((o) => `${o.agente}: ${o.n}`).join(", ") : "nenhuma";
  const agora = new Date(r.em);
  const proximas = r.agentes
    .filter((a) => a.status === "ativo")
    .map((a) => `${a.nome}: ${proximaRonda(a.rotina_texto, agora) ?? a.rotina_texto ?? "sem horário"}`)
    .join("; ");
  return `RETRATO DO MOMENTO (dados de ${quando}, horário de Brasília; só contagens, consultadas agora pelo servidor):
- Cadastros: ${c.total} (proprietários ${c.proprietarios}, inquilinos ${c.inquilinos}, admins ${c.admins}); destes, ${c.pareceTeste} parecem contas de teste (e-mail de teste/laboratório).
- Imóveis: ${r.imoveis.total} (publicados ${r.imoveis.publicados}).
- Pedidos de moradia: ${r.pedidos.total} no total, ${r.pedidos.ultimas24h} nas últimas 24h.
- Interessados (leads): ${r.leads.total} no total, ${r.leads.ultimas24h} nas últimas 24h.
- Contratos por status: ${lista(r.contratosPorStatus)}.
- Chamados abertos por prioridade: ${lista(r.chamadosAbertosPorPrioridade)}.
- Últimas rondas dos agentes (mais recentes primeiro):
${rondas}
- Ordens pendentes por agente: ${ordens}.
- Próxima ronda de cada agente ativo: ${proximas || "nenhum agente ativo"}.
Não está no retrato: faturamento, nomes de clientes, conversas, e a última migração aplicada.`;
}
