/*
  Correção 62-B3 — porta de entrada do avaliador. Roda: node --test src/lib/vistoria/entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PENDENCIA_IDENTIDADE, contaComoAvaliadorAtivo, ehPedidoDeAvaliador, podeAtivar, pendenciasDoCredenciamento, podeAprovarParaTeste, solicitacaoDoAvaliador, validarPedidoAvaliador } from "./entrada.ts";
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

test("E30: aprovar para teste nunca ativa; ativar só com a avaliação de teste registrada", () => {
  // Aprovar para teste leva a "em_teste" e nada além (a transição é a única coisa que a ação grava).
  const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const decidir = acoes.slice(acoes.indexOf("export async function adminDecidirCredenciamento"), acoes.indexOf("async function ativarParceiroDoAvaliador"));
  assert.match(decidir, /ativado_em: agora[^\n]*para === "ativo"|para === "ativo" && c\.status === "em_teste" \? \{ ativado_em/);
  assert.match(decidir, /if \(para === "ativo"\) \{[\s\S]*?comTesteConcluido\(a\.admin, \[id\]\)[\s\S]*?podeAtivar\(/, "ativar confere o registro do teste no servidor");
  assert.doesNotMatch(decidir.slice(decidir.indexOf('if (para === "em_teste") {'), decidir.indexOf("// E30")), /status: "ativo"/);
  // Regra pura.
  assert.equal(podeAtivar({ status: "em_teste", testeConcluido: false }).ok, false);
  assert.equal(podeAtivar({ status: "suspenso", testeConcluido: false }).ok, false, "reativar quem nunca fez o teste também não");
  assert.equal(podeAtivar({ status: "em_teste", testeConcluido: true }).ok, true);
  assert.equal(podeAtivar({ status: "solicitado", testeConcluido: true }).ok, false, "do pedido recebido não se pula para ativo");
  // Na interface, sem o teste registrado, o botão de ativar não existe (só o aviso).
  const tela = readFileSync(new URL("../../app/(dashboard)/admin/avaliadores/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /para === "ativo" && !testeFeito\.has\(c\.id\) \?[\s\S]*?data-testid="decidir-ativo-bloqueado"/);
});

test("E30: conta de teste não conta como avaliador ativo rumo aos 2 da chave", () => {
  assert.equal(contaComoAvaliadorAtivo({ status: "ativo", contaTeste: true }), false);
  assert.equal(contaComoAvaliadorAtivo({ status: "ativo", contaTeste: false }), true);
  assert.equal(contaComoAvaliadorAtivo({ status: "em_teste", contaTeste: false }), false);
  const tela = readFileSync(new URL("../../app/(dashboard)/admin/avaliadores/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /avaliadoresAtivos: ativos/);
  assert.match(tela, /contaComoAvaliadorAtivo\(\{ status: c\.status, contaTeste:/);
});
