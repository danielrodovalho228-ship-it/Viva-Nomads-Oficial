import { test } from "node:test";
import assert from "node:assert/strict";
import { painelMostraVoltar } from "./voltar-painel.ts";

test("E720: telas internas sem voltar próprio mostram o voltar do painel", () => {
  for (const p of ["/dashboard/avaliacoes", "/dashboard/pedidos", "/dashboard/imoveis", "/dashboard/imoveis/x/desempenho", "/dashboard/visitas", "/dashboard/contratos", "/dashboard/mensagens/"]) {
    assert.equal(painelMostraVoltar(p), true, p);
  }
});

test("E720: início, equipe e telas com voltar próprio não duplicam", () => {
  for (const p of ["/dashboard", "/admin/usuarios", "/dashboard/conta", "/dashboard/conta/perfil", "/dashboard/notificacoes", "/dashboard/verificacao", "/dashboard/fechamento", "/dashboard/estadia/abc", "/dashboard/visitas/abc", "/dashboard/contratos/abc/ficha", "/dashboard/leads/abc", "/dashboard/imoveis/novo", "/dashboard/imoveis/x/editar", "/dashboard/orcamentos/nova", "/dashboard/parceiro/avaliacao/x"]) {
    assert.equal(painelMostraVoltar(p), false, p);
  }
});
