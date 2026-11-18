/*
  E393 — o anúncio não abria pelo código público (VN-…), só pelo UUID: /imoveis/VN-3F9A2C dava 404, embora o código
  seja o que a pessoa vê na página e nos e-mails (codigoDoImovel) e cita no atendimento.
  Regra: /imoveis/<código> abre o MESMO anúncio, redirecionando para o endereço canônico /imoveis/<uuid>; só anúncio
  público (ativo); código que não bate com exatamente um anúncio continua 404.
  Roda: node --test src/lib/e393-imovel-por-codigo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codigoDoImovel, faixaUuidDoPrefixo, prefixoDoCodigo } from "./imovel-pagina.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("E393 — lê o código como aparece (qualquer caixa, com ou sem hífen) e recusa o que não é código", () => {
  assert.equal(prefixoDoCodigo("VN-3F9A2C"), "3F9A2C");
  assert.equal(prefixoDoCodigo("vn-3f9a2c"), "3F9A2C");
  assert.equal(prefixoDoCodigo("VN3F9A2C"), "3F9A2C");
  assert.equal(prefixoDoCodigo(" VN-UBE015 "), "UBE015");
  assert.equal(prefixoDoCodigo("3f9a2c1e-0000-4000-8000-000000000000"), null);
  assert.equal(prefixoDoCodigo("VN-3F9A"), null);
  assert.equal(prefixoDoCodigo("ube-015"), null);
});

test("E393 — o código de um UUID volta à faixa de UUIDs que começam por ele (ida e volta)", () => {
  const id = "3f9a2c1e-7b2d-4c11-9e0a-1234567890ab";
  const prefixo = prefixoDoCodigo(codigoDoImovel(id));
  assert.equal(prefixo, "3F9A2C");
  const faixa = faixaUuidDoPrefixo(prefixo!);
  assert.deepEqual(faixa, { de: "3f9a2c00-0000-0000-0000-000000000000", ate: "3f9a2cff-ffff-ffff-ffff-ffffffffffff" });
  assert.ok(id >= faixa!.de && id <= faixa!.ate);
  assert.equal(faixaUuidDoPrefixo("UBE015"), null); // não é hexadecimal: só anúncio de exemplo
});

test("E393 — o layout do imóvel resolve o código e redireciona para o endereço canônico", () => {
  const pagina = ler("app/(public)/imoveis/[id]/layout.tsx"); // antes do 404 e do loading.tsx
  assert.match(pagina, /prefixoDoCodigo\(decodeURIComponent\(id\)\)/);
  assert.match(pagina, /imovelPeloCodigo\(/);
  assert.match(pagina, /redirect\(`\/imoveis\/\$\{/);
  const dados = ler("lib/data/properties.ts");
  const fn = dados.slice(dados.indexOf("export const imovelPeloCodigo"));
  assert.match(fn.slice(0, 2000), /\.eq\("status", "active"\)/);
  assert.match(fn.slice(0, 2000), /\.gte\("id", faixa\.de\)/);
  assert.match(fn.slice(0, 2000), /\.lte\("id", faixa\.ate\)/);
});
