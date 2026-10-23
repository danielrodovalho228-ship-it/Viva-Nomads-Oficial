/*
  Correção 62-B3 — porta de entrada do avaliador. Roda: node --test src/lib/vistoria/entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PENDENCIA_IDENTIDADE, ehPedidoDeAvaliador, pendenciasDoCredenciamento, podeAprovarParaTeste, solicitacaoDoAvaliador, validarPedidoAvaliador } from "./entrada.ts";
import { CATEGORIAS_CATALOGO, categoriaValida, validarSolicitacao } from "../parceiros/regras.ts";

const CPF = "52998224725";
const base = { cidade: "Uberlândia", experienciaLink: "https://portfolio.exemplo.com", experienciaArquivo: false, aceiteConduta: true };

test("'vistoria' só pelo caminho do credenciamento: a solicitação comum e o catálogo continuam recusando", () => {
  assert.equal(categoriaValida("vistoria"), false);
  assert.ok(!CATEGORIAS_CATALOGO.some((c) => c.valor === "vistoria"));
  const r = validarSolicitacao({ nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF, categorias: ["vistoria"], cidades: ["Uberlândia"], aceite: true, descricao: "Avaliação de imóveis" });
  assert.equal(r.ok, false);
  const s = solicitacaoDoAvaliador({ nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF }, "Uberlândia", null, "u1", "ana@x.com");
  assert.deepEqual(s.categorias, ["vistoria"]);
  assert.equal(ehPedidoDeAvaliador(s.categorias), true);
  assert.equal(ehPedidoDeAvaliador(["limpeza"]), false);
});

test("quem NÃO é parceiro manda os dados de parceiro + os do credenciamento", () => {
  const ok = validarPedidoAvaliador({ ...base, jaParceiro: false, nome: "Ana Avaliadora", tipoPessoa: "pf", documento: "529.982.247-25" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.valor.parceiro, { nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF });
  const falta = validarPedidoAvaliador({ ...base, jaParceiro: false, nome: "A", tipoPessoa: "pf", documento: "11111111111" });
  assert.equal(falta.ok, false);
  if (!falta.ok) assert.deepEqual(falta.falta, ["Informar o nome público (o seu ou o da empresa).", "CPF válido."]);
});

test("quem JÁ é parceiro não repete dados (os campos de parceiro são ignorados)", () => {
  const r = validarPedidoAvaliador({ ...base, jaParceiro: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valor.parceiro, null);
  const sem = validarPedidoAvaliador({ jaParceiro: true, cidade: "", experienciaArquivo: false, aceiteConduta: false });
  assert.equal(sem.ok, false);
  if (!sem.ok) assert.equal(sem.falta.length, 3);
});

test("identidade não verificada: o pedido registra com pendência e a aprovação para teste fica bloqueada", () => {
  // A identidade não é campo do pedido: nada em validarPedidoAvaliador a recusa.
  assert.equal(validarPedidoAvaliador({ ...base, jaParceiro: true }).ok, true);
  assert.deepEqual(pendenciasDoCredenciamento({ identidadeVerificada: false }), [PENDENCIA_IDENTIDADE]);
  assert.deepEqual(pendenciasDoCredenciamento({ identidadeVerificada: true }), []);
  assert.equal(podeAprovarParaTeste({ status: "solicitado", identidadeVerificada: false }).ok, false);
  assert.equal(podeAprovarParaTeste({ status: "solicitado", identidadeVerificada: true }).ok, true);
  assert.equal(podeAprovarParaTeste({ status: "em_teste", identidadeVerificada: true }).ok, false);
});

test("textos da entrada: 'avaliação do imóvel' e 'avaliador credenciado'; nunca inspeção, perícia ou engenharia", () => {
  for (const f of ["src/app/(public)/parceiros/avaliadores/page.tsx", "src/lib/vistoria/entrada.ts"]) {
    const t = readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(t, /inspe[cç][aã]o|per[ií]cia|engenharia/i, f);
  }
});
