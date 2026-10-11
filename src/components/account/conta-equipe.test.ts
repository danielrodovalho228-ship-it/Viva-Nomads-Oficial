import test from "node:test";
import assert from "node:assert/strict";
import { mostraEquipe, ROTA_EQUIPE } from "./conta-equipe.ts";

test("admin vê Equipe e aprovações", () => {
  assert.equal(mostraEquipe("admin"), true);
});

test("owner, tenant e sem papel não veem", () => {
  for (const r of ["owner", "tenant", "", null, undefined, "ADMIN"]) assert.equal(mostraEquipe(r), false);
});

test("a rota é a área de aprovações da Central, coberta por ROTAS_APP", async () => {
  assert.equal(ROTA_EQUIPE, "/admin/agentes#aprovacoes");
  const { destinoDaRota } = await import("../../config/rotas-app.ts");
  assert.equal(destinoDaRota("/admin/agentes"), "app");
});
