// Harness de teste (Pista 3 — E306): carrega o buscarParceiros REAL (src/lib/data/parceiros-publico.ts) no node --test,
// trocando só as bordas — server-only, os clientes do Supabase (o público vira um banco em memória que registra as
// consultas) e a geocodificação — por dublês. Filtros, regras e montagem das URLs entram de verdade. Só o teste o registra.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "@/lib/supabase/public": `export function createPublicClient() { return globalThis.__E306.sb; }`,
  "@/lib/supabase/server": `export async function createClient() { return null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return null; }`,
  "@/lib/integrations/geocoding": `export async function geocodeForSave() { return { lat: 0, lng: 0, approximate: true }; }`,
  // A lista de municípios (JSON) só serve ao ufUnica da cidade digitada; a busca deste teste não filtra por cidade.
  "@/lib/municipios": `export const MUNICIPIOS = [];`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e306:" + spec, shortCircuit: true };
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
  if (url.startsWith("e306:")) return { format: "module", source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, ctx);
}
