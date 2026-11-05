/*
  E293 (retenção) — tabelas novas depois da auditoria: `avisos` (0286: pessoa, evento, título e link do aviso do sino) e
  `moderacao_ofensas` (0287: autor, conversa e o termo ofensivo enviado). As duas ligam uma pessoa a conteúdo e não
  estavam no inventário (src/config/retencao.ts): a guarda só reconhece colunas pelo nome, e `titulo`/`termo` não estavam
  na lista. Entram como fase 2 (só relatório simulado), prazo pendente — o prazo é decisão do Daniel (item 13), nada é
  apagado por esta mudança. A guarda passa a reconhecer `termo`.
  Roda: node --test src/lib/minimizacao/e293-inventario-0286-0287.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INVENTARIO } from "../../config/retencao.ts";

test("avisos e moderacao_ofensas estão no inventário, fase 2, sem prazo decidido (nada apagado)", () => {
  for (const origem of ["public.avisos", "public.moderacao_ofensas"]) {
    const item = INVENTARIO.find((x) => x.origem === origem);
    assert.ok(item, origem);
    assert.equal(item!.fase, 2, origem);
    assert.equal(item!.base, "pendente", origem);
    assert.equal(item!.prazoDias, null, origem);
    assert.ok(item!.finalidade.length > 5 && item!.dado.length > 5, origem);
  }
});

test("a guarda do inventário reconhece a coluna `termo` como dado pessoal", () => {
  const guarda = readFileSync(new URL("./inventario.test.ts", import.meta.url), "utf8");
  assert.match(guarda, /\|termo\|/);
});
