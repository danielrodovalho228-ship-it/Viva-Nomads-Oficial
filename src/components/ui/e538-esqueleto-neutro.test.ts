/* Roda: node --test src/components/ui/e538-esqueleto-neutro.test.ts
  E538: o esqueleto de carregamento é neutro — só blocos, nunca dado inventado (estadia, código de entrada, endereço,
  "Próximas visitas", "Suas propostas"…). Vale para todos os loading.tsx do app, os esqueletos de components/ui/skeleton.tsx
  e o carregando da entrada do painel (AuthGuard): nenhum texto visível, nenhuma leitura do seed de demonstração.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function arquivos(dir: string, nome: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) arquivos(p, nome, out);
    else if (f === nome) out.push(p);
  }
  return out;
}

/** Texto visível em JSX: o que fica entre `>` e `<` com alguma letra (comentários e expressões fora). */
function textosJsx(src: string): string[] {
  const semComentarios = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...semComentarios.matchAll(/>([^<>{}]*)</g)].map((m) => m[1].trim()).filter((t) => /[A-Za-zÀ-ú]/.test(t));
}

const DADO_INVENTADO = /estadia|check-?in|endere[çc]o|pr[óo]ximas visitas|suas propostas|c[óo]digo|R\$|Rua /i;

test("E538: todo loading.tsx do app só desenha blocos (sem texto, sem seed de demonstração)", () => {
  const lista = arquivos("src/app", "loading.tsx");
  assert.ok(lista.length >= 5, "acha os loading.tsx");
  for (const f of lista) {
    const s = readFileSync(f, "utf8");
    assert.deepEqual(textosJsx(s), [], `${f}: texto no esqueleto`);
    assert.doesNotMatch(s, /lib\/demo|DEMO_/, `${f}: lê dado de demonstração`);
  }
});

test("E538: os esqueletos de components/ui/skeleton.tsx não têm texto nem dado", () => {
  const s = readFileSync("src/components/ui/skeleton.tsx", "utf8");
  assert.deepEqual(textosJsx(s), []);
  assert.doesNotMatch(s.replace(/\/\*[\s\S]*?\*\//g, ""), DADO_INVENTADO);
  assert.doesNotMatch(s, /lib\/demo|DEMO_/);
});

test("E538: a entrada do painel (AuthGuard) carrega com o esqueleto neutro", () => {
  const s = readFileSync("src/components/layout/auth-guard.tsx", "utf8");
  const bloco = s.slice(s.indexOf('data-testid="auth-guard-carregando"') - 200, s.indexOf('data-testid="auth-guard-carregando"') + 200);
  assert.match(bloco, /<SkeletonLista \/>/);
  assert.deepEqual(textosJsx(bloco), []);
});
