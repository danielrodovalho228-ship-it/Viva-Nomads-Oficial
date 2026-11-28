// Harness de teste (E1240, ESPEC-E1240 v5, secção 5.2): carrega as ações REAIS das instruções de entrada
// (src/lib/data/checkin-actions.ts: instrucoesDoContrato e salvarInstrucoesEntrada) no node --test, trocando só as
// bordas por dublês: o cliente Supabase da sessão e o de serviço (globalThis.__e1240Sessao / __e1240Admin), o limite de
// tentativas (sempre deixa passar) e a revalidação do Next. A validação, a regra da âncora e a gravação entram de verdade.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "next/cache": `export function revalidatePath() {}`,
  "@/lib/supabase/server": `export async function createClient() { return globalThis.__e1240Sessao ?? null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1240Admin ?? null; }`,
  "@/lib/limites": `export const HORA = 3600; export async function consumirLimite() { return true; }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1240-checkin:" + spec, shortCircuit: true };
  const tentar = (base) => {
    for (const ext of ["", ".ts", ".tsx"]) if (existsSync(base + ext) && /\.\w+$/.test(base + ext)) return pathToFileURL(base + ext).href;
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
  if (url.startsWith("e1240-checkin:")) return { format: "module", source: STUBS[url.slice("e1240-checkin:".length)], shortCircuit: true };
  return next(url, ctx);
}
