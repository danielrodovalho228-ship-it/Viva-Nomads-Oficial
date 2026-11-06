/* Roda: node --test src/lib/e393-codigo-publico.test.ts
  E393: o código público ("VN-A02690", o que o morador cita no atendimento) abre o anúncio; o detalhe da visita e o cartão do imóvel na
  conversa levam ao anúncio. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codigoDoImovel, faixaDoCodigoPublico } from "./imovel-pagina.ts";

test("E393: o código vira uma faixa de ids que contém o id do anúncio (ida e volta com codigoDoImovel)", () => {
  const id = "a0269012-3456-7890-abcd-ef0123456789";
  const codigo = codigoDoImovel(id); // VN-A02690
  assert.equal(codigo, "VN-A02690");
  const f = faixaDoCodigoPublico(codigo)!;
  assert.equal(f.de, "a0269000-0000-0000-0000-000000000000");
  assert.equal(f.ate, "a02690ff-ffff-ffff-ffff-ffffffffffff");
  assert.ok(id >= f.de && id <= f.ate, "o id está na faixa");
  assert.ok("a0268fff-ffff-ffff-ffff-ffffffffffff" < f.de && "a0269100-0000-0000-0000-000000000000" > f.ate, "vizinhos ficam fora");
});

test("E393: variantes (minúscula, sem hífen, com espaços) resolvem; texto que não é código, não", () => {
  for (const t of ["VN-A02690", "vn-a02690", "VNA02690", " Vn-a02690 "]) assert.ok(faixaDoCodigoPublico(t), t);
  for (const t of ["", "VN-A0269", "VN-A026900", "VN-ZZZZZZ", "ube-001", "a0269012-3456-7890-abcd-ef0123456789"]) assert.equal(faixaDoCodigoPublico(t), null, t);
});

test("E393: a página do anúncio redireciona o código para o id antes do 404", () => {
  const p = readFileSync("src/app/(public)/imoveis/[id]/page.tsx", "utf8");
  assert.match(p, /const doCodigo = await idDoAnuncioPeloCodigo\(id\);\s+if \(doCodigo\) redirect\(`\/imoveis\/\$\{doCodigo\}`\);\s+notFound\(\);/);
  const d = readFileSync("src/lib/data/properties.ts", "utf8");
  assert.match(d, /export const idDoAnuncioPeloCodigo = cache\(/);
  assert.match(d, /\.eq\("status", "active"\)\.gte\("id", faixa\.de\)\.lte\("id", faixa\.ate\)\.limit\(2\)/);
  assert.match(d, /return ids\.length === 1 \? ids\[0\] : null;/);
});

test("E393: o detalhe da visita e o cartão do imóvel na conversa linkam o anúncio", () => {
  const v = readFileSync("src/app/(dashboard)/dashboard/visitas/[id]/page.tsx", "utf8");
  assert.match(v, /href=\{`\/imoveis\/\$\{v\.propertyId\}`\}[^>]*data-testid="visita-ver-anuncio"/);
  const m = readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8");
  assert.match(m, /active\.propertyId && !active\.pedidoParceiroId && \(\s*<Link href=\{`\/imoveis\/\$\{active\.propertyId\}`\}/);
  assert.match(m, /data-testid="conversa-contexto-link"/);
});
