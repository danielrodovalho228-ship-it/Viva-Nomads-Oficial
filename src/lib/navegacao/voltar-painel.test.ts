import { test } from "node:test";
import assert from "node:assert/strict";
import { painelMostraVoltar } from "./voltar-painel.ts";

test("E720: telas internas sem voltar próprio mostram o voltar do painel", () => {
  for (const p of ["/dashboard/avaliacoes", "/dashboard/pedidos", "/dashboard/imoveis", "/dashboard/imoveis/x/desempenho", "/dashboard/orcamentos/nova", "/dashboard/visitas", "/dashboard/contratos", "/dashboard/mensagens/", "/dashboard/conta"]) {
    assert.equal(painelMostraVoltar(p), true, p);
  }
});

test("E720: início, equipe e telas com voltar próprio não duplicam", () => {
  for (const p of ["/dashboard", "/admin/usuarios", "/dashboard/qa/emails", "/dashboard/conta/perfil", "/dashboard/notificacoes", "/dashboard/verificacao", "/dashboard/fechamento", "/dashboard/estadia/abc", "/dashboard/visitas/abc", "/dashboard/contratos/abc/ficha", "/dashboard/leads/abc", "/dashboard/imoveis/novo", "/dashboard/imoveis/x/editar", "/dashboard/parceiro/avaliacao/x"]) {
    assert.equal(painelMostraVoltar(p), false, p);
  }
});

test("E720: 'Estadia confirmada' e a visão do convidado (sem voltar próprio) mostram o voltar do painel", () => {
  assert.equal(painelMostraVoltar("/dashboard/estadia/abc/confirmada"), true);
  assert.equal(painelMostraVoltar("/dashboard/estadia/abc/convidado"), true);
  assert.equal(painelMostraVoltar("/dashboard/estadia/abc/mensagens"), false);
});
