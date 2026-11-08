// E746: o CEP 38400-000 (centro de Uberlândia) respondia "Não encontramos esse CEP" no Passo 3 do anúncio — beco sem saída.
// CEP genérico (termina em 000, numa faixa de UF conhecida) agora tem saída guiada: explica, guarda a UF e leva à busca pelo endereço.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buscarCep, ehCepGenerico, mensagemCep, URL_VIACEP } from "./buscar.ts";
import { aplicarResultadoCep } from "./aplicar.ts";

const VIA = (c: string) => `${URL_VIACEP}/${c}/json/`;
const simular = (resp: Record<string, { status: number; corpo: unknown }>) => async (url: string) => {
  const r = resp[url] ?? { status: 404, corpo: {} };
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.corpo };
};

test("E746: 38400-000 (ViaCEP não conhece) vira CEP de faixa de MG, com saída guiada", async () => {
  const r = await buscarCep("38400-000", simular({ [VIA("38400000")]: { status: 200, corpo: { erro: "true" } } }));
  assert.deepEqual(r, { tipo: "faixa", uf: "MG" });
  assert.match(mensagemCep(r), /genérico/);
  assert.match(mensagemCep(r), /busque pelo endereço/);
  assert.doesNotMatch(mensagemCep(r), /Não encontramos/);
});

test("E746: só os CEPs que terminam em 000 e caem numa faixa conhecida; os demais seguem 'não encontrado'", async () => {
  assert.equal(ehCepGenerico("38400000"), true);
  assert.equal(ehCepGenerico("38482288"), false);
  assert.equal(ehCepGenerico("00000000"), false); // fora de qualquer faixa
  const r = await buscarCep("38482-288", simular({ [VIA("38482288")]: { status: 200, corpo: { erro: "true" } } }));
  assert.deepEqual(r, { tipo: "nao_encontrado" });
});

test("E746: o CEP de faixa só preenche a UF (cidade e rua ficam com a pessoa) e a tela oferece a busca pelo endereço", () => {
  assert.deepEqual(aplicarResultadoCep({ tipo: "faixa", uf: "MG" }, { rua: "", bairro: "", cidade: "" }, new Set()), { uf: "MG" });
  const tela = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-onde-fica.tsx", "utf8");
  assert.match(tela, /r\?\.tipo === "faixa"/);
  assert.match(tela, /r\.tipo === "cidade" \|\| r\.tipo === "faixa"/);
});
