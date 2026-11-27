// Harness de teste (E1229, a anulação de registros): carrega as ações REAIS de src/lib/data/anulacao-actions.ts no
// node --test, trocando só as bordas por dublês: o cliente Supabase da sessão e o de serviço (globalThis.__e1229Sessao
// / __e1229Admin), o portão da equipe (__e1229EhEquipe), a abertura do chamado (grava em __e1229Chamados) e o aviso
// (grava em __e1229Avisos). As regras da anulação entram de verdade.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "next/server": `export function after(fn) { return typeof fn === "function" ? fn() : undefined; }`,
  "next/cache": `export function revalidatePath() {}`,
  "@/lib/supabase/server": `export async function createClient() { return globalThis.__e1229Sessao ?? null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1229Admin ?? null; }`,
  "@/lib/data/admin-guard": `export async function ehAdmin() { return globalThis.__e1229EhEquipe === true; }`,
  "@/lib/data/atendimento-actions": `export async function abrirChamado(input) {
    (globalThis.__e1229Chamados ??= []).push(input);
    return { ok: true, numero: "CH-2026-000777", aviso: "", emergencia: false };
  }
  export async function responderComoAdmin(id, texto, interno) {
    (globalThis.__e1229Respostas ??= []).push({ id, texto, interno });
    return { ok: true };
  }`,
  "@/lib/notifications": `export async function notify(p) { (globalThis.__e1229Avisos ??= []).push(p); }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1229:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1229:")) return { format: "module", source: STUBS[url.slice("e1229:".length)], shortCircuit: true };
  return next(url, ctx);
}
