import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTA_VERIFICACAO_TESTE, laudoSimuladoTeste, ramoVerificacao } from "./contas-de-teste.ts";

// Prompt 23 (item 3): o inquilino1 (is_teste) via "em breve" na /dashboard/verificacao — a página só conhecia
// demonstração × conta real e nunca chamava a /api/caf/verify, que já gerava o laudo simulado.

test("p23 — conta de teste vê o laudo simulado; conta real segue 'em breve'; demonstração não muda", () => {
  assert.equal(ramoVerificacao({ demo: false, teste: true }), "teste");
  assert.equal(ramoVerificacao({ demo: false, teste: false }), "em_breve");
  assert.equal(ramoVerificacao({ demo: false, teste: null }), "carregando");
  assert.equal(ramoVerificacao({ demo: true, teste: true }), "demonstracao");
  assert.equal(ramoVerificacao({ demo: true, teste: false }), "demonstracao");
});

test("p23 — o laudo simulado vem rotulado 'TESTE — verificação simulada'", () => {
  assert.equal(NOTA_VERIFICACAO_TESTE, "TESTE — verificação simulada");
  assert.ok(laudoSimuladoTeste().notes.includes(NOTA_VERIFICACAO_TESTE));
  assert.equal(laudoSimuladoTeste().demo, true);
});

test("p23 — quem decide é o servidor: /api/caf/status devolve `teste` lido de profiles.is_teste", () => {
  const rota = readFileSync(new URL("../app/api/caf/status/route.ts", import.meta.url), "utf8");
  assert.match(rota, /select\("cpf, is_teste"\)/);
  assert.match(rota, /teste: perfil\?\.is_teste === true/);
  const pagina = readFileSync(new URL("../app/(dashboard)/dashboard/verificacao/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /fetch\("\/api\/caf\/status"\)/);
  assert.match(pagina, /fetch\("\/api\/caf\/verify", \{ method: "POST" \}\)/);
  // O fechamento também usa o laudo simulado da conta de teste (a jornada segue até a assinatura).
  const fechamento = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.match(fechamento, /st\?\.teste === true/);
});
