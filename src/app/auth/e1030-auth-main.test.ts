import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * E1030 (Gerente, ORDEM-DUET-129, 18/11/2026; era o D-V8 da varredura, falha esperada desde 22/10) — a tela de entrar
 * não tinha `<main>`: montava só uma `<div>` em grade, e o leitor de tela ficava sem o marco principal.
 *
 * As telas de `/auth` (entrar, redefinir senha, código, intenção, pronto) ficam fora do layout das páginas públicas e
 * do painel, que são quem abre o `<main>` nos outros lugares. A casca de autenticação (`src/app/auth/layout.tsx`)
 * passa a abrir o marco para todas, uma vez. Nenhuma página nem componente de autenticação abre outro: dois marcos
 * principais na mesma página é HTML inválido (a regra do t311).
 */
const PASTA = new URL(".", import.meta.url).pathname;
const layout = readFileSync(join(PASTA, "layout.tsx"), "utf8");

/** Todos os .tsx de uma pasta, com as subpastas. */
function arquivosTsx(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivosTsx(caminho) : nome.endsWith(".tsx") ? [caminho] : [];
  });
}

test("a casca de autenticação abre o marco principal em volta de todas as telas de /auth, uma vez", () => {
  assert.match(layout, /return <main>\{children\}<\/main>;/);
  assert.equal((layout.match(/<main[\s>]/g) ?? []).length, 1, "um só <main> na casca");
});

test("nenhuma tela de /auth abre um segundo <main>", () => {
  const paginas = arquivosTsx(PASTA).filter((a) => !a.endsWith("layout.tsx"));
  assert.ok(paginas.some((a) => a.endsWith(join("auth", "page.tsx"))), "achei a tela de entrar");
  assert.ok(paginas.length >= 5, `esperava as 5 telas de /auth, achei ${paginas.length}`);
  for (const a of paginas) assert.doesNotMatch(readFileSync(a, "utf8"), /<main[\s>]/, `${a}: segundo <main>`);
});

test("nem os componentes que essas telas montam (src/components/auth e as duas etapas)", () => {
  const componentes = [...arquivosTsx(join(PASTA, "../../components/auth")), join(PASTA, "../../components/seguranca/duas-etapas.tsx")];
  assert.ok(componentes.length >= 2);
  for (const a of componentes) assert.doesNotMatch(readFileSync(a, "utf8"), /<main[\s>]/, `${a}: abre um <main> dentro do da casca`);
});
