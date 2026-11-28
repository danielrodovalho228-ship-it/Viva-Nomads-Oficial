// Harness de teste (E1247, ORDEM-DUET 1280 — as fugas C1 e C3 da mordida): carrega as ROTINAS REAIS
// rodarPreAceitacao (src/lib/propostas/pre-aceitacao-servidor.ts) e rodarCaucaoPrazos (src/lib/caucao/prazos-servidor.ts)
// no node --test, trocando só as bordas: "server-only" e o notify (que grava cada chamada em globalThis.__e1247Avisos,
// o aviso que iria para a caixa). O cliente admin é o falso que o teste passa; as chaves das rotinas ligam-se por
// process.env antes do import. A tabela das rotinas (avisoDaRotina) e as regras dos prazos entram de verdade.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "@/lib/notifications": `export async function notify(p) { (globalThis.__e1247Avisos ??= []).push(p); return { ok: true }; }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1247-rotinas:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1247-rotinas:")) return { format: "module", source: STUBS[url.slice("e1247-rotinas:".length)], shortCircuit: true };
  return next(url, ctx);
}
