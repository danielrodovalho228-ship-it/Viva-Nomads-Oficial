// Harness de teste (E1222, ORDEM-DUET-1075): carrega o módulo REAL das fontes públicas do avaliador
// (src/lib/vistoria/vitrine-servidor.ts) no node --test, trocando só as bordas: a assinatura da foto e o estado da
// identidade (que falam com o Storage e com outras tabelas). As regras da vitrine entram de verdade. Só os testes o
// registam; o cliente Supabase falso vem do próprio teste.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "@/lib/data/avatar-url": `export async function signAvatarPath() { return null; }`,
  "@/lib/identidade/estado-servidor": `export async function estadoIdentidade() { return { estado: "nao_enviada" }; }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1222-vitrine:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1222-vitrine:")) return { format: "module", source: STUBS[url.slice("e1222-vitrine:".length)], shortCircuit: true };
  return next(url, ctx);
}
