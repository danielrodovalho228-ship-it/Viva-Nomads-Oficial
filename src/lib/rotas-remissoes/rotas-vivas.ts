/*
  Família 2 (rotas e remissões): as rotas públicas VIVAS, lidas do próprio app (src/app/<rota>/page.tsx), menos as SUSPENSAS
  (redirecionam à home de propósito). Uma remissão de conteúdo só pode apontar para uma rota daqui. Só para testes.
*/
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Páginas que existem no código mas estão suspensas (E563: preços) — remissão a elas é remissão morta. */
export const ROTAS_SUSPENSAS = ["/precos", "/planos"] as const;

function paginas(dir: string, rota: string[] = []): string[][] {
  const out: string[][] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) {
      if (nome.startsWith("_") || nome === "api") continue;
      out.push(...paginas(p, /^\(.*\)$/.test(nome) ? rota : [...rota, nome]));
    } else if (nome === "page.tsx") out.push(rota);
  }
  return out;
}

const PADROES = paginas("src/app").map((seg) => new RegExp(`^/${seg.map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s)).join("/")}$`.replace("^/$", "^/$")));

/** A rota existe como página e não está suspensa. Para /ajuda/<tema>, o tema tem de existir. */
export function rotaViva(caminho: string, temasAjuda: readonly string[]): boolean {
  const c = caminho.replace(/[#?].*$/, "").replace(/\/+$/, "") || "/";
  if ((ROTAS_SUSPENSAS as readonly string[]).some((s) => c === s || c.startsWith(`${s}/`))) return false;
  const tema = c.match(/^\/ajuda\/([^/]+)$/)?.[1];
  if (tema && tema !== "fale-com-a-viva") return temasAjuda.includes(tema);
  return PADROES.some((r) => r.test(c));
}

/** Caminhos internos ("/algo/coisa") escritos num texto. */
export function caminhosNoTexto(texto: string): string[] {
  return [...texto.matchAll(/(?<![\w.@/:-])\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*/g)].map((m) => m[0]);
}
