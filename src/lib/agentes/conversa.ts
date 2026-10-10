/*
  Chat dos agentes "igual WhatsApp" — regras puras (sem React, sem rede), para teste.
  O servidor continua sendo quem responde e quem registra a ordem; aqui só se
  decide, para o que o servidor devolveu, se vira ordem na fila ou disparo na hora.
*/

/** Distância (px) do fim a partir da qual a lista conta como "no fim". */
export const MARGEM_FIM_PX = 48;

export interface MedidasRolagem {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

/** A lista está no fim (ou não rola)? Some o botão "ir para o fim". */
export function estaNoFim(m: MedidasRolagem, margem = MARGEM_FIM_PX): boolean {
  return m.scrollHeight - m.scrollTop - m.clientHeight <= margem;
}

const RE_PRIORIDADE = /\bP([0-3])\b/i;
const RE_URGENTE = /\b(agora|urgente|urg[eê]ncia|imediat\w*)\b/i;

/** P0..P3 escrita no texto ("P0 corrija…"), ou null. */
export function prioridadeDoTexto(texto: string): "P0" | "P1" | "P2" | "P3" | null {
  const m = RE_PRIORIDADE.exec(texto);
  return m ? (`P${m[1]}` as "P0" | "P1" | "P2" | "P3") : null;
}

/** P0/P1 ou "agora/urgente": o agente é acionado na hora. */
export function ehUrgente(texto: string): boolean {
  const p = prioridadeDoTexto(texto);
  return p === "P0" || p === "P1" || RE_URGENTE.test(texto);
}

export type DestinoEnvio = "pergunta" | "ordem" | "executar";

/**
 * Pergunta (o servidor não pediu ação) = só a resposta do agente.
 * Pedido de ação urgente = ordem + disparo; os demais = ordem para a próxima ronda.
 */
export function decidirEnvio(texto: string, servidorPediuAcao: boolean): DestinoEnvio {
  if (!servidorPediuAcao) return "pergunta";
  return ehUrgente(texto) ? "executar" : "ordem";
}

/** "11:32" no fuso de Brasília; "" se a data for inválida. */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(d);
}

/** Resposta do chat dizendo o que foi feito ("Registrei e acionei o Renato às 11:32"). */
export function textoFeito(nome: string, acionou: boolean, agoraIso: string): string {
  return acionou ? `Registrei e acionei ${nome} às ${horaCurta(agoraIso)}.` : `Registrei a ordem para ${nome}; vai na próxima ronda.`;
}

/** Máximo de linhas de uma resposta do agente antes de recolher o resto em "ver detalhes". */
export const LINHAS_RESPOSTA_CURTA = 5;

export interface RespostaDividida {
  resumo: string;
  detalhes: string;
}

/**
 * Resposta longa do agente: mostra as primeiras linhas e recolhe o resto.
 * Linhas vazias não contam; se cabe no limite, não há "detalhes". Só apresentação:
 * o texto completo continua intacto (resumo + detalhes).
 */
export function dividirResposta(texto: string, maxLinhas = LINHAS_RESPOSTA_CURTA): RespostaDividida {
  const linhas = texto.split("\n");
  let vistas = 0;
  let corte = linhas.length;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].trim() === "") continue;
    if (vistas === maxLinhas) {
      corte = i;
      break;
    }
    vistas++;
  }
  if (corte >= linhas.length) return { resumo: texto, detalhes: "" };
  return { resumo: linhas.slice(0, corte).join("\n").trimEnd(), detalhes: linhas.slice(corte).join("\n").trim() };
}

// ── Texto do agente: negrito e listas simples (parser seguro, sem HTML) ──────────
export interface Trecho {
  texto: string;
  negrito: boolean;
}
export type BlocoTexto = { tipo: "p" | "li"; trechos: Trecho[] };

/** "a **b** c" → [a, b (negrito), c]. Asteriscos soltos (sem par) ficam como texto. */
function trechosDe(linha: string): Trecho[] {
  const out: Trecho[] = [];
  let resto = linha;
  for (;;) {
    const m = /\*\*([^*]+?)\*\*/.exec(resto);
    if (!m) break;
    if (m.index > 0) out.push({ texto: resto.slice(0, m.index), negrito: false });
    out.push({ texto: m[1], negrito: true });
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto) out.push({ texto: resto, negrito: false });
  return out;
}

/**
 * Lê o texto do agente como blocos: parágrafo ("p") e item de lista ("li": "- ", "* " ou "• ").
 * Títulos "#" perdem o "#"; nada vira HTML — quem desenha usa só elementos React com o texto como filho.
 */
export function lerTextoSimples(texto: string): BlocoTexto[] {
  const blocos: BlocoTexto[] = [];
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    if (!linha) continue;
    const item = /^(?:[-*•])\s+(.*)$/.exec(linha);
    if (item) {
      blocos.push({ tipo: "li", trechos: trechosDe(item[1]) });
      continue;
    }
    blocos.push({ tipo: "p", trechos: trechosDe(linha.replace(/^#{1,6}\s+/, "")) });
  }
  return blocos;
}
