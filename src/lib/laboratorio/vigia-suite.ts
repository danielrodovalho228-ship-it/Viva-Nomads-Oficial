/*
  ORDEM-DUET-273: a vigia da suíte. O agendador do GitHub atrasa (7–10 h) ou perde as corridas agendadas do
  laboratorio.yml. Esta vigia corre num cron da Vercel MARGEM_MIN depois de cada slot e confere se a corrida do slot
  arrancou na main (agendada ou manual, desde ANTECEDENCIA_MIN antes do slot). Se não arrancou, despacha o workflow na
  main. Mais de 2 h depois do slot já não despacha: a corrida deixaria de contar para a noite (regra do ≤2 h).
  O laboratório só usa o banco local do runner e integrações simuladas: o despacho nunca toca a produção.
  Teste: src/lib/laboratorio/vigia-suite.test.ts
*/

/** Os slots do cron do laboratorio.yml, em UTC (o teste prende os dois). */
export const SLOTS_UTC = [
  { h: 7, m: 17 },
  { h: 15, m: 17 },
  { h: 23, m: 17 },
] as const;
/** O cron da Vercel corre CRON_DEPOIS_MIN depois do slot; a decisão só exige MARGEM_MIN, para um cron adiantado não perder o slot. */
export const CRON_DEPOIS_MIN = 15;
export const MARGEM_MIN = 10;
export const ANTECEDENCIA_MIN = 10;
const LIMITE_MIN = 120;

const REPO = "danielrodovalho228-ship-it/Viva-Nomads-Oficial";
const WORKFLOW = "laboratorio.yml";
const MIN = 60_000;

export type CorridaGithub = { id: number; event: string; head_branch: string; created_at: string };
export type AcaoVigia = "coberto" | "cedo" | "fora" | "despachar";

/** O último slot que já passou (pode ser o da véspera). */
export function slotDoMomento(agora: Date): Date {
  for (let dia = 0; dia <= 1; dia++) {
    const candidatos = SLOTS_UTC.map((s) => Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() - dia, s.h, s.m))
      .filter((t) => t <= agora.getTime())
      .sort((a, b) => b - a);
    if (candidatos.length > 0) return new Date(candidatos[0]);
  }
  throw new Error("slot impossível");
}

export function decidirVigia(agora: Date, corridas: CorridaGithub[]): { acao: AcaoVigia; slot: Date; corrida?: number } {
  const slot = slotDoMomento(agora);
  const desde = slot.getTime() - ANTECEDENCIA_MIN * MIN;
  const achada = corridas.find((c) => c.head_branch === "main" && Date.parse(c.created_at) >= desde);
  if (achada) return { acao: "coberto", slot, corrida: achada.id };
  const passados = (agora.getTime() - slot.getTime()) / MIN;
  if (passados < MARGEM_MIN) return { acao: "cedo", slot };
  if (passados > LIMITE_MIN) return { acao: "fora", slot };
  return { acao: "despachar", slot };
}

export type ResultadoVigia = {
  acao: AcaoVigia;
  slot: string;
  corrida?: number;
  /** Quantas corridas da main a leitura autenticada devolveu desde o início da janela do slot. */
  lidas: number;
  despachada: boolean;
  estadoDespacho?: number;
};

/** Lê as corridas do slot com o token e, se faltar a do slot, despacha (salvo `verificar`, que só lê). */
export async function rodarVigia(o: { token: string; agora: Date; fetch?: typeof fetch; verificar?: boolean }): Promise<ResultadoVigia> {
  const f = o.fetch ?? fetch;
  const cabecalhos = {
    authorization: `Bearer ${o.token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "vigia-suite",
  };
  const slot = slotDoMomento(o.agora);
  const desde = new Date(slot.getTime() - ANTECEDENCIA_MIN * MIN).toISOString().replace(/\.\d{3}Z$/, "Z");
  const base = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}`;
  const r = await f(`${base}/runs?branch=main&per_page=30&created=${encodeURIComponent(`>=${desde}`)}`, { headers: cabecalhos, cache: "no-store" });
  if (!r.ok) throw new Error(`a leitura das corridas falhou: HTTP ${r.status}`);
  const corpo = (await r.json()) as { total_count?: number; workflow_runs?: CorridaGithub[] };
  const corridas = corpo.workflow_runs ?? [];
  const d = decidirVigia(o.agora, corridas);
  const resultado: ResultadoVigia = { acao: d.acao, slot: d.slot.toISOString(), corrida: d.corrida, lidas: corpo.total_count ?? corridas.length, despachada: false };
  if (d.acao !== "despachar" || o.verificar) return resultado;
  const p = await f(`${base}/dispatches`, { method: "POST", headers: { ...cabecalhos, "content-type": "application/json" }, body: JSON.stringify({ ref: "main" }) });
  resultado.estadoDespacho = p.status;
  resultado.despachada = p.status === 204;
  return resultado;
}
