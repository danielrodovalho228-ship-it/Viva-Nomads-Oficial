/*
  E1043 (ORDEM-DUET-237): desde o E1037 (#4034) o processo do Playwright corre DENTRO da imagem oficial
  (mcr.microsoft.com/playwright:v…-noble), que só garante o Node e os navegadores. O t1680 caso C chamava `psql`, que
  o runner tinha e a imagem não tem: na corrida 44693948067 caiu com `spawnSync psql ENOENT`, e o caso D (em série) não
  correu. Erro de método registado: os ensaios do E1037 só cobriram a fatia 20 e não procuraram binários do sistema.
  Este teste prende a regra: um spec (ou fixture) do E2E só lança processos com o Node em que corre (process.execPath);
  nada de binários do sistema (psql, curl, git, docker…). O banco do laboratório fala-se pelo cliente JS `postgres`.
  Roda: node --test tests/laboratorio/e1043-specs-sem-binarios-do-sistema.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|mjs|js)$/.test(n) ? [p] : [];
  });
}

const comProcessos = arquivos("tests/e2e")
  .map((f) => ({ f, s: readFileSync(f, "utf8") }))
  .filter(({ s }) => /from ["']node:child_process["']|require\(["'](node:)?child_process["']\)/.test(s));

test("os specs do E2E só lançam processos com o Node em que correm (process.execPath), nunca binários do sistema", () => {
  const ruins: string[] = [];
  for (const { f, s } of comProcessos) {
    for (const m of s.matchAll(/\b(spawn|spawnSync|execSync|execFileSync|execFile)\(\s*([^,)\n]+)/g)) {
      if (m[2].trim() !== "process.execPath") ruins.push(`${f}: ${m[1]}(${m[2].trim()}`);
    }
    // `exec` do child_process (string de shell) também não; o `.exec(` das RegExp não conta.
    for (const m of s.matchAll(/(?<![.\w])exec\(\s*["'`]/g)) ruins.push(`${f}: exec(${s.slice(m.index! + 5, m.index! + 25)}`);
  }
  assert.deepEqual(ruins, [], "a imagem do Playwright não tem binários do sistema (ex.: psql)");
});

test("o t1680 envelhece o pedido pelo cliente JS do Postgres, sem psql", () => {
  const t1680 = readFileSync("tests/e2e/specs/t1680-e917-recuperar-por-codigo.spec.ts", "utf8");
  assert.doesNotMatch(t1680, /psql/);
  assert.match(t1680, /from "postgres"/);
  assert.match(t1680, /recovery_sent_at = now\(\) - interval '1 day'/);
});

test("o cliente `postgres` é dependência de desenvolvimento fixa (3.4.9, sem dependências próprias)", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
  assert.equal(pkg.devDependencies?.postgres, "3.4.9");
  assert.equal(pkg.dependencies?.postgres, undefined, "não vai para o pacote de produção");
});
