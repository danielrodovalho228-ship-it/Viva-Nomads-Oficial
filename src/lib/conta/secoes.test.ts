/*
  A1 — a Conta em oito telas: ordem do desenho, seção pela rota (com os endereços antigos) e as âncoras da página longa.
  Roda: node --test src/lib/conta/secoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SECOES_CONTA, destinoDaAncora, itemDaSecao, secaoDaRota } from "./secoes.ts";

test("oito seções na ordem do mockup, cada uma com a sua rota e uma descrição curta", () => {
  assert.deepEqual(
    SECOES_CONTA.map((s) => s.rotulo),
    ["Perfil", "Avaliações", "Papéis e intenção", "Dados", "Privacidade", "Notificações", "Pagamentos", "Ajuda"],
  );
  for (const s of SECOES_CONTA) {
    assert.equal(s.href, `/dashboard/conta/${s.id}`);
    assert.ok(s.descricao.length > 0 && s.descricao.length <= 60, s.id);
  }
  assert.equal(itemDaSecao("dados").rotulo, "Dados");
});

test("seção pela rota: /dashboard/conta é Perfil; endereços antigos caem na seção nova; o resto é null", () => {
  assert.equal(secaoDaRota("/dashboard/conta"), "perfil");
  assert.equal(secaoDaRota("/dashboard/conta/"), "perfil");
  assert.equal(secaoDaRota("/dashboard/conta/notificacoes?x=1"), "notificacoes");
  assert.equal(secaoDaRota("/dashboard/conta/seguranca"), "privacidade");
  assert.equal(secaoDaRota("/dashboard/conta/excluir"), "privacidade");
  assert.equal(secaoDaRota("/dashboard/conta/perfil-publico"), null);
  assert.equal(secaoDaRota("/dashboard/conta/dados/x"), null);
  assert.equal(secaoDaRota("/dashboard"), null);
});

test("âncoras da página longa levam à tela nova (mantendo a busca e a âncora que ainda existe)", () => {
  assert.equal(destinoDaAncora("#confianca"), "/dashboard/conta/privacidade");
  assert.equal(destinoDaAncora("#confianca", "?linkedin=conectado"), "/dashboard/conta/privacidade?linkedin=conectado");
  assert.equal(destinoDaAncora("#documento"), "/dashboard/conta/dados#documento");
  assert.equal(destinoDaAncora("celular"), "/dashboard/conta/dados#celular");
  assert.equal(destinoDaAncora("#sair-da-viva"), "/dashboard/conta/excluir");
  assert.equal(destinoDaAncora("#perfil-publico"), "/dashboard/conta/perfil");
  assert.equal(destinoDaAncora(""), null);
  assert.equal(destinoDaAncora("#qualquer"), null);
});
