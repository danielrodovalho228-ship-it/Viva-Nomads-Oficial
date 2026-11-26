// Harness de teste (E1069, ORDEM-DUET-1059): carrega o módulo REAL do pacote de provas registrado
// (src/lib/fiscal/pacote-provas.ts) no node --test, trocando só as bordas por dublês: o cliente de serviço
// (@/lib/supabase/admin devolve o cliente falso que o teste põe em globalThis.__e1069Admin), o registro único
// (@/lib/fiscal/registro) e o gerador de PDF (@/lib/fiscal/pdf), que só anotam as chamadas em globalThis.__e1069Chamadas.
// As regras do pacote (contrato-provas, nomes, prefixos) entram de verdade. Só os testes o registram.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1069Admin ?? null; }`,
  "@/lib/fiscal/pdf": `export async function gerarPdf(conteudo) { globalThis.__e1069Chamadas.push({ fn: "gerarPdf", conteudo }); return new Uint8Array([37, 80, 68, 70]); }`,
  "@/lib/fiscal/registro": `
    export async function registroDe() { globalThis.__e1069Chamadas.push({ fn: "registroDe" }); return null; }
    export async function registrarDocumento(_admin, o) {
      globalThis.__e1069Chamadas.push({ fn: "registrarDocumento", o });
      const bytes = await o.conteudo({ numero: 1, versao: 1, codigo: "TESTE" });
      return { bytes };
    }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1069-pacote:" + spec, shortCircuit: true };
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
  if (url.startsWith("e1069-pacote:")) return { format: "module", source: STUBS[url.slice("e1069-pacote:".length)], shortCircuit: true };
  return next(url, ctx);
}
