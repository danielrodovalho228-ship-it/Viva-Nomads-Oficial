/*
  E227-B — parceria tem UMA fila: parceiro_solicitacoes (0190). Na aba "Pendentes" de /admin/parceiros cada pedido
  mostra há quantos dias espera, do mais antigo para o mais novo. Sem situações novas: aprovar ou recusar basta.
  Roda: node --test src/lib/parceiros/fila-pendentes.test.ts
*/

import { ITENS_CHECKLIST } from "./regras.ts";

const DIA_MS = 86_400_000;

/** Dias inteiros desde o pedido (nunca negativo; data inválida conta como hoje). */
export function diasNaFila(criadoEm: string, agora: Date): number {
  const t = Date.parse(criadoEm);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - t) / DIA_MS));
}

/** "hoje", "há 1 dia", "há N dias". */
export function textoHaDias(n: number): string {
  if (n <= 0) return "hoje";
  return n === 1 ? "há 1 dia" : `há ${n} dias`;
}

/**
 * E234 — a idade de um pedido de parceria, UMA conta só para as duas telas: o cartão da aba Pendentes
 * (/admin/parceiros) e a linha "pedidos de parceria" da Visão geral. Dias inteiros desde o pedido (sem arredondar
 * para cima): 16,6 dias = "há 16 dias" nas duas.
 */
export function idadePedidoParceria(criadoEm: string, agora: Date): string {
  return textoHaDias(diasNaFila(criadoEm, agora));
}

/** Visão geral: "mais antigo há N dias" / "mais antigo de hoje" — pela MESMA idadePedidoParceria. */
export function maisAntigoParceria(criadoEm: string | null | undefined, agora: Date): string | null {
  if (!criadoEm || !Number.isFinite(Date.parse(criadoEm))) return null;
  const idade = idadePedidoParceria(criadoEm, agora);
  return idade === "hoje" ? "mais antigo de hoje" : `mais antigo ${idade}`;
}

/** Do mais antigo para o mais novo (empate: id, para a ordem não pular entre recargas). */
export function ordenarPendentes<T extends { criado_em: string; id: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em) || a.id.localeCompare(b.id));
}

/**
 * E351 (c), resíduo — o estado de cada pedido de parceria À VISTA na fila de pendentes do admin (antes só uma linha
 * cinza no pé da ficha dizia que "Aprovar" estava travado). Mesmas regras do botão Aprovar (checklistCompleto) e do
 * cadastro mínimo. PURO.
 *  - "aguardando": a pessoa ainda não confirmou o e-mail;
 *  - "incompleto": falta dado do pedido (e-mail, categoria, cidade ou CPF/CNPJ) — não dá para aprovar como está;
 *  - "checklist": dados ok, checklist da equipe pela metade;
 *  - "pronto": checklist completo, "Aprovar" liberado.
 */
export type EstadoFicha = { tipo: "aguardando" | "incompleto" | "checklist" | "pronto"; rotulo: string };

export function estadoDaFicha(f: {
  status: string;
  email: string | null;
  categorias: readonly string[];
  cidades: readonly string[];
  documento: string | null;
  checklist: Partial<Record<string, unknown>> | null | undefined;
}): EstadoFicha {
  if (f.status === "aguardando_email") return { tipo: "aguardando", rotulo: "Aguardando a pessoa confirmar" };
  const sem = [
    !f.email && "e-mail",
    !f.categorias.length && "categoria",
    !f.cidades.length && "cidade",
    !f.documento && "CPF/CNPJ",
  ].filter(Boolean) as string[];
  if (sem.length) return { tipo: "incompleto", rotulo: `Cadastro incompleto · sem ${sem.join(", ")}` };
  const itens = [...ITENS_CHECKLIST.map((i) => f.checklist?.[i.chave] === true), !!f.checklist?.documento_conferido_em];
  const faltam = itens.filter((ok) => !ok).length;
  if (faltam > 0) return { tipo: "checklist", rotulo: `Não aprovável ainda · faltam ${faltam} de ${itens.length} itens do checklist` };
  return { tipo: "pronto", rotulo: "Pronto para aprovar" };
}
