/*
  TODOS os agentes com dados AO VIVO no chat da Central (não só o Moacir).
  Cada agente consulta o banco na hora da pergunta, com as consultas prontas
  da área dele, e ANTES de repetir uma pendência da última ronda confere se
  ela já foi resolvida (migração aplicada, chamado resolvido). PURO (node --test).
*/
import type { Achado, Ronda } from "./central.ts";
import type { Consulta } from "./gerente.ts";
import { horaBrasilia } from "./retrato.ts";

/** Consultas prontas de cada área (as mesmas do Moacir, filtradas). */
export const AREA_AO_VIVO: Record<string, Consulta[]> = {
  otavio: ["rondas_recentes", "migracoes", "chamados_abertos", "chamados_resolvidos", "ultimo_deploy"],
  renato: ["ordens_pendentes", "migracoes", "ultimo_deploy"],
  bruno: ["rondas_recentes", "migracoes", "ultimo_deploy"],
  marina: ["contagens", "migracoes", "ultimo_deploy"],
  carla: ["contagens", "chamados_abertos", "chamados_resolvidos"],
  viva: ["chamados_abertos", "chamados_resolvidos"],
  helena: ["ordens_pendentes", "migracoes", "chamados_abertos"],
  rafael: ["contagens", "chamados_resolvidos", "rondas_recentes"],
  luana: ["contagens"],
  thiago: ["contagens", "ordens_pendentes"],
  sergio: ["contagens", "migracoes"],
};
export function consultasDaArea(slug: string): Consulta[] {
  return AREA_AO_VIVO[slug] ?? ["contagens"];
}

export interface MigracaoAplicada {
  version: string;
  name: string;
}
export interface ChamadoResolvido {
  numero: string;
  quando: string;
  nota: number | null;
}
/** O que o banco diz AGORA, para conferir as pendências da última ronda. */
export interface Conferencia {
  migracoes: MigracaoAplicada[];
  resolvidos: ChamadoResolvido[];
  /** Chamados ainda abertos (número), para não dar como resolvido o que não está. */
  abertos: string[];
}

/** "0083_pacote_otavio" / "20261007000083" → "0083". */
export function numeroMigracao(m: MigracaoAplicada): string | null {
  const porNome = /^(\d{4})_/.exec(m.name ?? "")?.[1];
  if (porNome) return porNome;
  const v = /^\d{14}$/.test(m.version ?? "") ? m.version.slice(-4) : null;
  return v;
}

export interface Resolvido {
  ref: string;
  motivo: string;
}

const RE_MIGRACAO = /\b(0\d{3})\b/g;
const RE_CHAMADO = /\bVN-\d{6}\b/g;

/** Itens citados no texto (migração 0083, chamado VN-000101) que JÁ estão resolvidos no banco. */
export function conferirPendencias(texto: string, c: Conferencia): Resolvido[] {
  const aplicadas = new Set(c.migracoes.map(numeroMigracao).filter((x): x is string => !!x));
  const resolvidos = new Map(c.resolvidos.map((r) => [r.numero, r]));
  const abertos = new Set(c.abertos);
  const out = new Map<string, Resolvido>();
  for (const m of texto.matchAll(RE_MIGRACAO)) {
    if (aplicadas.has(m[1])) out.set(`migração ${m[1]}`, { ref: m[1], motivo: `migração ${m[1]}: já aplicada em produção` });
  }
  for (const m of texto.matchAll(RE_CHAMADO)) {
    const r = resolvidos.get(m[0]);
    if (r && !abertos.has(m[0]))
      out.set(m[0], { ref: m[0], motivo: `${m[0]}: resolvido ${horaBrasilia(r.quando)}${r.nota ? ` (nota ${r.nota})` : ""}` });
  }
  return [...out.values()];
}

export const MARCA_RESOLVIDO = "[resolvido desde a última ronda]";

/** Rondas com as pendências já resolvidas marcadas (o modelo não as repete como abertas). */
export function marcarResolvidos<T extends Pick<Ronda, "resumo" | "achados">>(rondas: T[], c: Conferencia): T[] {
  const marca = (t: string) => {
    const rs = conferirPendencias(t, c);
    return rs.length ? `${t} ${MARCA_RESOLVIDO} (${rs.map((r) => r.motivo).join("; ")})` : t;
  };
  return rondas.map((r) => ({
    ...r,
    achados: (Array.isArray(r.achados) ? r.achados : []).map((a: Achado) => ({ ...a, titulo: a?.titulo ? marca(a.titulo) : a?.titulo, detalhe: a?.detalhe ? marca(a.detalhe) : a?.detalhe })),
    resumo: marca(r.resumo ?? ""),
  }));
}

export const REGRA_AO_VIVO = `- Você tem DADOS AO VIVO DA SUA ÁREA (abaixo), lidos agora. Eles valem mais que a sua última ronda.
- Antes de listar uma pendência da última ronda, confira nos dados ao vivo e na lista JÁ RESOLVIDO. O que já foi resolvido (migração aplicada, chamado resolvido) você NÃO lista como pendente: diga "resolvido desde a última ronda".
- Diga "dados de <hora>" ao usar os dados ao vivo. Quando a informação vier só da sua última ronda (não do banco agora), diga "da minha ronda de <hora>".`;

export function blocoAoVivo(dados: string, resolvidos: Resolvido[], agora: Date): string {
  const lista = resolvidos.length ? resolvidos.map((r) => `- ${r.motivo}`).join("\n") : "- nada do que a última ronda citou foi resolvido desde então";
  return `DADOS AO VIVO DA SUA ÁREA (dados de ${horaBrasilia(agora.toISOString())}, horário de Brasília):\n${dados}\n\nJÁ RESOLVIDO DESDE A ÚLTIMA RONDA (conferido no banco agora):\n${lista}`;
}

/** Itens da última ronda: achados (título) ou, sem achados, as frases do resumo. */
function itensDaRonda(r: Pick<Ronda, "resumo" | "achados">): string[] {
  const ach = (Array.isArray(r.achados) ? r.achados : []).map((a) => `${a?.prioridade ? `${a.prioridade}: ` : ""}${a?.titulo ?? a?.detalhe ?? ""}`.trim()).filter(Boolean);
  if (ach.length) return ach;
  return (r.resumo ?? "")
    .split(/[;\n]|\.\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/**
 * Resposta do LABORATÓRIO (sem IA) para os agentes: separa o que a última ronda
 * listou entre "resolvido desde a última ronda" e "ainda pendente", conferindo
 * no banco agora. Mesma regra que o modelo recebe em produção.
 */
export function respostaSimuladaAgente(p: { nome: string; ultima: Pick<Ronda, "resumo" | "achados" | "iniciada_em"> | null; conferencia: Conferencia; agora: Date }): string {
  const fim = `dados de ${horaBrasilia(p.agora.toISOString())} (laboratório, sem IA)`;
  if (!p.ultima) return `${p.nome}: ainda não tenho ronda registrada. Pelos dados ao vivo da minha área, não vejo pendência nova.\n${fim}`;
  const itens = itensDaRonda(p.ultima);
  const resolvidos: string[] = [];
  const pendentes: string[] = [];
  for (const i of itens) {
    const rs = conferirPendencias(i, p.conferencia);
    if (rs.length) resolvidos.push(`${i} → ${rs.map((r) => r.motivo).join("; ")}`);
    else pendentes.push(i);
  }
  return [
    `Da minha ronda de ${horaBrasilia(p.ultima.iniciada_em)}, conferido no banco agora:`,
    `Resolvido desde a última ronda: ${resolvidos.length ? resolvidos.join(" | ") : "nada"}.`,
    `Ainda pendente: ${pendentes.length ? pendentes.join(" | ") : "nada"}.`,
    fim,
  ].join("\n");
}
