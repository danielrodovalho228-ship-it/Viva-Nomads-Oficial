// Carregador de TESTE (E640): deixa o `node --test` importar módulos do servidor de verdade — resolve o alias "@/",
// imports sem extensão e troca só as portas de fora (Supabase, limites, avisos) pelos dublês de ./dubles.ts.
// Nada disto entra no app: só os testes de fluxo registram este arquivo.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as caminho } from "node:path";

const RAIZ = caminho(dirname(fileURLToPath(import.meta.url)), "../..");
const DUBLES = pathToFileURL(caminho(RAIZ, "lib/testes/dubles.ts")).href;

/** Módulos de fora que os testes de fluxo trocam por dublês (a chave é o alias do app). */
const TROCAS = {
  "server-only": "data:text/javascript,export {}",
  "@/lib/supabase/server": `${DUBLES}`,
  "@/lib/supabase/admin": `${DUBLES}`,
  "@/lib/limites": `${DUBLES}`,
  "@/lib/notifications": `${DUBLES}`,
  "@/lib/notifications/push-admins": `${DUBLES}`,
};

const EXTENSOES = [".ts", ".tsx", "/index.ts"];

function comExtensao(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXTENSOES) if (existsSync(base + e)) return base + e;
  return null;
}

export async function resolve(specifier, context, next) {
  // Pacotes do Next sem extensão (o ESM puro do Node exige o .js).
  if (/^next\/[a-z-]+$/.test(specifier)) return next(`${specifier}.js`, context);
  if (TROCAS[specifier]) return { url: TROCAS[specifier], shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const alvo = comExtensao(caminho(RAIZ, specifier.slice(2)));
    if (alvo) return { url: pathToFileURL(alvo).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const alvo = comExtensao(caminho(dirname(fileURLToPath(context.parentURL)), specifier));
    if (alvo) return { url: pathToFileURL(alvo).href, shortCircuit: true };
  }
  return next(specifier, context);
}
