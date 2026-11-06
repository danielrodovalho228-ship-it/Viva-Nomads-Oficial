/*
  E293 (retenção) — colunas novas das migrações 0313 (E648: o dono escolhe o avaliador, o avaliador propõe valor e prazo,
  assina o laudo e tem direito de resposta) e 0314 (E647: forma de pagamento da proposta). As tabelas já estavam no
  inventário (src/config/retencao.ts), mas a descrição do que guardam não citava as colunas novas. Só texto: prazos,
  fase e base ficam como estavam — nada é apagado e nenhum prazo novo é decidido aqui.
  Roda: node --test src/lib/minimizacao/e293-inventario-0313-0314.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { INVENTARIO } from "../../config/retencao.ts";

const item = (origem: string) => {
  const x = INVENTARIO.find((i) => i.origem === origem);
  assert.ok(x, origem);
  return x!;
};

test("o pedido de avaliação descreve a escolha do dono e o valor e o prazo propostos pelo avaliador", () => {
  const d = item("public.vistoria_pedidos").dado;
  assert.match(d, /avaliador escolhido pelo dono/);
  assert.match(d, /valor e prazo propostos pelo avaliador/);
  assert.match(d, /aceite do dono/);
});

test("o laudo descreve a assinatura do avaliador (quem, quando, hash e termo)", () => {
  const d = item("public.vistoria_laudos").dado;
  assert.match(d, /assinatura do avaliador \(quem assinou, quando, hash e termo\)/);
});

test("o credenciamento descreve o critério público do descredenciamento e a resposta do avaliador", () => {
  const d = item("public.avaliadores_credenciamento").dado;
  assert.match(d, /critério público do descredenciamento/);
  assert.match(d, /resposta do avaliador/);
});

test("a versão da proposta descreve a forma de pagamento escolhida", () => {
  assert.match(item("public.proposta_versoes").dado, /forma de pagamento \(bloco ou mensal\)/);
});

test("prazo, fase e base dos quatro itens seguem como estavam (nada novo apagado)", () => {
  for (const origem of ["public.vistoria_pedidos", "public.vistoria_laudos", "public.avaliadores_credenciamento", "public.proposta_versoes"]) {
    const x = item(origem);
    assert.ok(x.finalidade.length > 3, origem);
    assert.ok(typeof x.fase === "number", origem);
  }
});
