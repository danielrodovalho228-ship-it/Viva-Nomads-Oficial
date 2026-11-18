// Harness de teste (Pista 3, lote 2 — bloco E do E722): carrega o pre-aceitacao-servidor.ts REAL no node --test e troca
// só as bordas (server-only, envio de aviso, chave, leitura de período e de versão) por dublês. A regra pura
// (pre-aceitacao.ts) e o silêncio (notifications/silencio.ts) entram de verdade. Não entra no app; só os testes o registram.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  // Cada aviso enviado fica registrado com o instante do relógio do teste (globalThis.__E722.agora).
  "@/lib/notifications": `export async function notify(n) {
    const g = globalThis.__E722;
    g.avisos.push({ userId: n.userId, subject: n.subject, corpo: n.body(n.name ?? ""), em: g.agora ? new Date(g.agora.getTime()) : null });
    return { ok: true };
  }`,
  "@/lib/flags": `export const PRE_ACEITACAO_72H_ATIVA = true;`,
  "@/lib/data/periodo-servidor": `export async function conflitoNoImovel(_admin, propertyId) { return globalThis.__E722.conflito(propertyId); }`,
  "@/lib/data/propostas-servidor": `export const COLUNAS_VERSAO = "*"; export function termosDaLinha(v) { return v; }`,
  "@/lib/contrato-periodo": `export function periodoEmDias(inicio, dias) { return { inicio, dias }; }`,
  "./regras": `export function diasDosTermos() { return 180; }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e722-harness:" + spec, shortCircuit: true };
  const tentar = (base) => {
    for (const ext of ["", ".ts"]) if (existsSync(base + ext) && /\.\w+$/.test(base + ext)) return pathToFileURL(base + ext).href;
    return null;
  };
  if (spec.startsWith("@/")) {
    const url = tentar(pr(RAIZ, "src", spec.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && !/\.\w+$/.test(spec)) {
    const url = tentar(pr(dirname(fileURLToPath(ctx.parentURL)), spec));
    if (url) return { url, shortCircuit: true };
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("e722-harness:")) return { format: "module", source: STUBS[url.slice("e722-harness:".length)], shortCircuit: true };
  return next(url, ctx);
}
