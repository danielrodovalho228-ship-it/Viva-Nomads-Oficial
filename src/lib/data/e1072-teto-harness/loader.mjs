// Harness de teste (E1072, nota do desenho da pilha — o teto vale para TODO o registro, incluindo o 1º): carrega a ação
// REAL marcarPagamentoRecebido (src/lib/data/contratos-actions.ts) no node --test, trocando só as bordas por dublês:
// o cliente Supabase da sessão e o de serviço (globalThis.__e1072Sessao / __e1072Admin), a conta do contrato por bloco
// (componentesDosContratos: globalThis.__e1072Esperado, ou lança se for "falha") e os módulos de tela e de recibo que a
// ação importa mas não usa no registro. As regras do registro (componentes, o que falta, a parte) entram de verdade.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "next/server": `export function after() {}`,
  "@/lib/supabase/server": `export async function createClient() { return globalThis.__e1072Sessao ?? null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1072Admin ?? null; }`,
  "@/lib/supabase/usuario-da-leitura": `export async function usuarioDaLeitura() { return null; }`,
  "@/lib/fiscal/emitir": `export async function emitirDoPagamentoComRegistro() { return null; }`,
  "@/lib/data/properties": `export async function listMyProperties() { return []; }`,
  "@/lib/data/taxa-dono-servidor": `export async function taxaDosContratosDoDono() { return new Map(); }`,
  "@/lib/data/contrato-componentes": `export async function componentesDosContratos(_admin, contratos) {
    const e = globalThis.__e1072Esperado;
    if (e === "falha") throw new Error("leitura da conta do contrato falhou");
    return new Map(contratos.map((c) => [c.id, new Map((c.blocos ?? []).map((b) => [b.numero, e]))]));
  }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1072-teto:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1072-teto:")) return { format: "module", source: STUBS[url.slice("e1072-teto:".length)], shortCircuit: true };
  return next(url, ctx);
}
