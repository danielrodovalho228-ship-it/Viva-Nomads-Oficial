/*
  Guardas da ordem 3eb3c64b (t8 / t44). node --test (sem alias @).
  1) Visão geral: com checklist, o botão principal leva ao próximo passo, mas sempre existe o link "Continuar de onde parou".
  2) Pedido ao fotógrafo: data e observação são campos controlados — o React 19 limpa o formulário após cada envio,
     e um erro (telefone na observação) não pode apagar a data escolhida (o 2º envio ficava bloqueado por "data obrigatória").
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const visao = readFileSync(new URL("../app/(dashboard)/dashboard/visao-geral-client.tsx", import.meta.url), "utf8");

test("Visão geral: rascunho em andamento tem o link 'Continuar de onde parou' sem etapa forçada", () => {
  assert.match(visao, /data-testid="retomar-rascunho"/);
  assert.match(visao, /href=\{`\/dashboard\/imoveis\/novo\?draft=\$\{encodeURIComponent\(draft\.id\)\}`\}/);
  assert.match(visao, /Continuar de onde parou/);
});

// Prompt 31a: o formulário antigo de pedido ao fotógrafo saiu (a contratação pela plataforma vem no 31b).
