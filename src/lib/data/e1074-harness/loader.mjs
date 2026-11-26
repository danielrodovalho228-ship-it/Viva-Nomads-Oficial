// Harness de teste (E1074, no padrão da ORDEM-DUET-1059): carrega as duas cargas REAIS do pacote de provas
// (src/lib/data/contrato-provas.ts, das partes, e src/lib/data/contrato-admin.ts, da equipe) no node --test, trocando
// só as bordas por dublês: os clientes Supabase (sessão e serviço) devolvem o cliente falso que o teste põe em
// globalThis.__e1074Db, e a checagem de acesso (contrato-assinar-actions) deixa passar. As regras de montagem do
// pacote entram de verdade. Só os testes o registram.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "@/lib/supabase/server": `export async function createClient() { return globalThis.__e1074Db ?? null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1074Db ?? null; } export const AVATARS_BUCKET = "avatars"; export const AVATAR_SIGNED_TTL = 1800;`,
  "@/lib/data/contrato-assinar-actions": `
    export async function getContratoParaAssinar() { return { imovel: "Studio Centro", estado: { selo: "Em vigência" } }; }
    export async function getContratoParaEquipe() { return globalThis.__e1074Base ?? null; }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1074-provas:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1074-provas:")) return { format: "module", source: STUBS[url.slice("e1074-provas:".length)], shortCircuit: true };
  return next(url, ctx);
}
