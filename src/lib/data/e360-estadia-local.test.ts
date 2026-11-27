/* Roda: node --test src/lib/data/e360-estadia-local.test.ts
  E360: "Suas estadias" no painel do morador identifica o imóvel: além do título (que pode ser genérico, ex. "Carteira 3"),
  mostra bairro, cidade e o código do anúncio. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const est = readFileSync("src/lib/data/estadia.ts", "utf8");
const tela = readFileSync("src/app/(dashboard)/dashboard/visao-geral-client.tsx", "utf8");

test("E360: a estadia da home leva o local (bairro, cidade) e o código do anúncio", () => {
  assert.match(est, /export function localDaEstadia\(/);
  assert.match(est, /local: string;/);
  assert.match(est, /local: localDaEstadia\(c\), topo: topo\.texto/);
  assert.match(est, /código \$\{codigoDoImovel\(c\.property_id\)\}/);
});

test("E360: o cartão 'Suas estadias' mostra o local abaixo do título", () => {
  assert.match(tela, /data-testid="home-estadia-imovel">\{e\.imovel\}/);
  assert.match(tela, /\{e\.local && <span className="block text-sm text-muted" data-testid="home-estadia-local">\{e\.local\}<\/span>\}/);
});
