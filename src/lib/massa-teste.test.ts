import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTAS, IMOVEIS, CHAMADOS, CONTRATOS, hostProibido } from "../../scripts/seed-teste/massa.mjs";

const doc = readFileSync("docs/massa-de-teste.md", "utf8");

test("o inventário em docs lista todo imóvel e chamado do seed", () => {
  for (const i of IMOVEIS) assert.ok(doc.includes(i.id), `imóvel ${i.id} fora do doc`);
  for (const c of CHAMADOS) {
    assert.ok(doc.includes(c.id), `chamado ${c.id} fora do doc`);
    assert.ok(doc.includes(c.assunto));
  }
});

test("o inventário em docs lista todo contrato do seed, em imóvel do seed, com estado", () => {
  assert.ok(CONTRATOS.length >= 3);
  for (const c of CONTRATOS) {
    assert.ok(doc.includes(c.id), `contrato ${c.id} fora do doc`);
    assert.ok(doc.includes(c.estado), `estado "${c.estado}" fora do doc`);
    assert.ok(IMOVEIS.some((i: { id: string }) => i.id === c.imovel));
  }
});

test("dois contratos ativos nunca ficam no mesmo imóvel (trava de sobreposição)", () => {
  const ativos = CONTRATOS.filter((c: { status: string }) => c.status === "ativo").map((c: { imovel: string }) => c.imovel);
  assert.equal(new Set(ativos).size, ativos.length);
});

test("todo dono de imóvel e autor de chamado é uma conta do seed, e os ids não se repetem", () => {
  const chaves = new Set(CONTAS.map((c: { chave: string }) => c.chave));
  for (const i of IMOVEIS) assert.ok(chaves.has(i.dono));
  for (const c of CHAMADOS) assert.ok(chaves.has(c.autor));
  const ids = [...IMOVEIS, ...CHAMADOS, ...CONTRATOS].map((x: { id: string }) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("o seed recusa a URL de produção e aceita a de teste", () => {
  assert.equal(hostProibido("https://app.vivanomads.com.br"), true);
  assert.equal(hostProibido("https://abc.supabase.co"), false);
});

test("o seed liga is_teste e grava chamado simulado", () => {
  const src = readFileSync("scripts/seed-teste/index.mjs", "utf8");
  assert.match(src, /is_teste: true/);
  assert.match(src, /simulacao: true/);
  assert.match(src, /hostProibido\(url\)/);
});
