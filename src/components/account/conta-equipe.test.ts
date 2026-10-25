import test from "node:test";
import assert from "node:assert/strict";
import { mostraEquipe, ROTA_ADMIN, ROTA_EQUIPE } from "./conta-equipe.ts";

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

test("NAV-A: Painel Admin e Equipe e aprovações moram na barra verde do admin, com as mesmas rotas", async () => {
  const { MENU_POR_PAPEL } = await import("../../config/menu-por-papel.ts");
  const { readFileSync } = await import("node:fs");
  const admin = JSON.stringify(MENU_POR_PAPEL.filter((s) => s.papel === "admin"));
  assert.ok(admin.includes(`"href":"${ROTA_ADMIN}"`));
  assert.ok(admin.includes(`"href":"${ROTA_EQUIPE}"`));
  const f = readFileSync(new URL("./conta-menu.tsx", import.meta.url), "utf8");
  assert.ok(!f.includes('label: "Painel Admin"'));
});
