/*
  E744, varredura dos dados de exemplo no JavaScript do painel (família do E975/E980; ordem do Gerente de 16/11/2026).
  A persona FICTÍCIA do modo demonstração (um nome e um e-mail inventados) morava em src/lib/store.ts, que toda tela
  do painel importa: iam no JavaScript das 42 telas, para toda conta (medido nas quatro personas do laboratório).
  Decisão do Gerente (16/11/2026): a persona SAI de vez — nenhuma tela a mostra (sem usuário, o painel manda para
  /auth), e dado de demonstração que nada exibe é peso morto com risco de vazamento. Quem precisa dos PAPÉIS da
  demonstração (sem sessão) usa uma identidade sem nome nem e-mail (src/lib/demo/papeis.ts).
  O t1674 cobra o mesmo no que o navegador recebe.
  Roda: node --test src/lib/demo/e744-identidade-de-exemplo-fora-do-pacote.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
const rel = (p: string) => p.slice(SRC.length);
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// Montados em pedaços para este arquivo não ser, ele mesmo, um lugar onde a persona mora.
const NOME = ["Marcos", "Andrade"].join(" ");
const EMAIL = ["marcos", "exemplo.com"].join("@");

test("a persona fictícia não existe em nenhum arquivo do produto (nem em comentário)", () => {
  const comPersona = arquivos(SRC).filter((p) => {
    const t = readFileSync(p, "utf8");
    return t.includes(NOME) || t.includes(EMAIL);
  });
  assert.deepEqual(comPersona.map(rel), []);
  assert.equal(existsSync(join(SRC, "lib/demo/persona.ts")), false);
});

test("nenhum arquivo do produto usa DEMO_USER", () => {
  const usam = arquivos(SRC).filter((p) => /\bDEMO_USER\b/.test(semComentarios(readFileSync(p, "utf8"))));
  assert.deepEqual(usam.map(rel), []);
});

test("a identidade da demonstração tem só papéis e plano: sem nome e sem e-mail", async () => {
  const { PAPEIS_DA_DEMONSTRACAO } = await import("./papeis.ts");
  assert.deepEqual(PAPEIS_DA_DEMONSTRACAO, { id: "demo-owner", name: "", email: "", role: "owner", fullName: "", plan: "gestor", isOwner: true, isTenant: true });
});

test("sem usuário: o modo ativo e o usuário de exibição usam essa identidade, e só com a demonstração valendo", () => {
  assert.match(semComentarios(ler("lib/roles.ts")), /\?\? PAPEIS_DA_DEMONSTRACAO/);
  const modo = semComentarios(ler("lib/demo/demo-mode.tsx"));
  assert.match(modo, /return user \?\? \(demo \? PAPEIS_DA_DEMONSTRACAO : null\);/);
});
