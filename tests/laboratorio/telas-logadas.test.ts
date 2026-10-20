import { test } from "node:test";
import assert from "node:assert/strict";
import { telasDaPersona, telasDoDisco, telasForaDaLista } from "../e2e/fixtures/telas-logadas.ts";

/**
 * Guarda do t183 (todas as telas logadas a 390 px): a lista estática de telas precisa bater com
 * src/app/(dashboard)/**\/page.tsx. Tela nova sem entrada na lista (ou com parâmetro sem decisão) falha aqui,
 * antes de passar despercebida pela varredura.
 */
test("toda tela logada do disco está na lista do t183 (ou na lista de rotas com parâmetro)", () => {
  const { faltando } = telasForaDaLista();
  assert.deepEqual(faltando, [], `adicione em tests/e2e/fixtures/telas-logadas.ts: ${faltando.join(", ")}`);
});

test("a lista do t183 não tem tela que não existe mais", () => {
  const { sobrando } = telasForaDaLista();
  assert.deepEqual(sobrando, [], `tire de tests/e2e/fixtures/telas-logadas.ts: ${sobrando.join(", ")}`);
});

test("o disco tem as telas básicas e o admin visita também o painel comum", () => {
  const disco = telasDoDisco();
  assert.ok(disco.includes("/dashboard") && disco.includes("/admin"), disco.join(", "));
  const adm = telasDaPersona("admin");
  assert.ok(adm.includes("/dashboard/conta/perfil") && adm.includes("/admin/usuarios"));
  assert.ok(!telasDaPersona("inquilino").some((r) => r.startsWith("/admin")));
  assert.ok(telasDaPersona("inquilino").every((r) => !r.includes("[")), "nenhuma rota com [parâmetro] é visitada literalmente");
});
