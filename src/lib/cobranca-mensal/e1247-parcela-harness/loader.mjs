// Harness de teste (E1247 passo 2, PR 1 — a parcela; ESPEC-E1247-PASSO-2, secção 4): carrega a ROTINA REAL
// rodarCobrancaMensal (src/lib/cobranca-mensal/servidor.ts) e as AÇÕES REAIS registrarPagamentoMensal e
// confirmarPagamentoMensal (src/lib/cobranca-mensal/acoes.ts) no node --test, trocando só as bordas: "server-only", a
// revalidação do Next, o limite de tentativas, os clientes Supabase (globalThis.__e1247pSessao / __e1247pAdmin) e o
// envio do notify. O notify falso guarda cada chamada (globalThis.__e1247pEnvios: o e-mail que sairia) e grava o aviso
// pela gravarAviso REAL (a mesma chamada do notify de verdade), no banco falso do teste: a renovação, a referência e a
// resolução entram de verdade.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "next/cache": `export function revalidatePath() {}`,
  "@/lib/supabase/server": `export async function createClient() { return globalThis.__e1247pSessao ?? null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1247pAdmin ?? null; }`,
  "@/lib/limites": `export const HORA = 3600; export async function consumirLimite() { return true; }`,
  "@/lib/notifications": `import { gravarAviso } from "@/lib/notifications/avisos-servidor";
    export async function notify(p) {
      (globalThis.__e1247pEnvios ??= []).push(p);
      if (p.userId) await gravarAviso({ usuarioId: p.userId, evento: p.event, papel: p.papelAviso, url: p.pushUrl, refId: p.refId, prioridade: p.prioridadeAviso, titulo: p.tituloAviso, texto: p.textoAviso, imovelId: p.imovelId });
      return { email: true, whatsapp: false };
    }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1247-parcela:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1247-parcela:")) return { format: "module", source: STUBS[url.slice("e1247-parcela:".length)], shortCircuit: true };
  return next(url, ctx);
}
