/*
  Estático (laboratório verde, faixa D): todo data-testid="..." que a spec t190 confere no HTML existe no código,
  e a t130 não conta POST de leitura como gravação. O t190 esperava "valor-medio-cidade", que a página nunca teve
  (o bloco real é "precos-medios", condicional a 3+ anúncios). Roda: node --experimental-strip-types --test src/lib/spec-t190-testids.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

function fontes(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fontes(p, acc);
    else if (/\.(tsx|ts)$/.test(nome) && !/\.test\./.test(nome)) acc.push(p);
  }
  return acc;
}

test("t190: cada data-testid esperado no HTML existe em src/", () => {
  const spec = ler("tests/e2e/specs/t190-seo-robots-jsonld.spec.ts");
  const ids = [...spec.matchAll(/data-testid="([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 1);
  const codigo = fontes(join(raiz, "src")).map((p) => readFileSync(p, "utf8")).join("\n");
  const faltando = [...new Set(ids)].filter((id) => !codigo.includes(`data-testid="${id}"`));
  assert.deepEqual(faltando, []);
});

test("t190: valor médio da cidade é conferido só quando o bloco existe (precisa de 3+ anúncios)", () => {
  const spec = ler("tests/e2e/specs/t190-seo-robots-jsonld.spec.ts");
  assert.ok(!spec.includes("valor-medio-cidade"));
  assert.match(spec, /if \(html\.includes\('data-testid="precos-medios"'\)\)/);
});

test("t130: só conta POST que leva candidatura ou mensagem, não o POST de leitura da página", () => {
  const spec = ler("tests/e2e/specs/t130-reserva-imovel.spec.ts");
  assert.match(spec, /postData\(\)/);
  assert.doesNotMatch(spec, /if \(r\.method\(\) === "POST"\) gravacoes\.push/);
});
