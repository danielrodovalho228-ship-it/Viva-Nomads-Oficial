/*
  Estático (laboratório verde, faixa D, lab 5d5f433e): quatro specs que falhavam por causa do próprio spec.
  - t36: a taxa congelada no aceite vem da faixa do proprietário (regra.ts), não do plano antigo (sem assinatura).
  - t64: /dashboard/locacoes do dono redireciona para Contratos; a medida espera o <main> ter conteúdo.
  - t71: a caixa da foto do cartão existe também sem <img> (espaço reservado).
  - t82: o navegador chama só /api/auth/entrar; o /token do Supabase é chamado pelo servidor (ordem dddccd2f).
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

test("t36 confere a taxa da faixa, não a do plano", () => {
  const spec = ler("tests/e2e/specs/t36-cadastro-ponta-a-ponta.spec.ts");
  assert.match(spec, /FAIXAS_COMISSAO_PADRAO/);
  assert.doesNotMatch(spec, /config\/planos|essencial\.comissao/);
});

test("t64 espera o conteúdo do <main> antes de medir", () => {
  const spec = ler("tests/e2e/specs/t64-telas-largas.spec.ts");
  assert.match(spec, /expect\.poll\(medir/);
});

test("t71 mede a caixa da foto, não só o <img>", () => {
  const spec = ler("tests/e2e/specs/t71-busca-topo.spec.ts");
  assert.match(spec, /\[class\*="aspect-"\]/);
});

test("t82 conta o POST /api/auth/entrar e nenhum /token no navegador", () => {
  const spec = ler("tests/e2e/specs/t82-login-celular.spec.ts");
  assert.match(spec, /expect\(logins\)\.toBe\(1\)/);
  assert.match(spec, /expect\(tokensNoNavegador\)\.toBe\(0\)/);
});

test("a regra usada pelo t36 existe: 1–2 imóveis = 12%", async () => {
  const { FAIXAS_COMISSAO_PADRAO } = await import("./cobranca/regra.ts");
  assert.equal(FAIXAS_COMISSAO_PADRAO[0].taxa, 0.12);
});
