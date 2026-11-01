/*
  Achado nº 27 (erros/estados vazios) — Admin → Destinos. As quatro leituras secundárias (buscas de 30 dias, lugares
  mais usados, "Não achei meu local" e avisos de lugar errado) engoliam o erro: o painel dizia "Nenhum…" e o número
  ficava 0. Agora cada uma devolve null na falha, o painel diz que não leu e o número vira "—".
  Roda: node --test src/lib/data/achado27-admin-destinos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pg = readFileSync(new URL("../../app/(dashboard)/admin/destinos/page.tsx", import.meta.url), "utf8");

test("as quatro leituras devolvem null na falha (nunca [] calado)", () => {
  assert.equal((pg.match(/if \(error\) return null;/g) ?? []).length, 4);
  assert.doesNotMatch(pg, /\.catch\(\(\) => \[\]\)/);
  assert.doesNotMatch(pg, /if \(error\) return \[\];/);
});

test("cada painel diz que não leu antes do 'Nenhum…', e os números viram '—'", () => {
  for (const [nulo, vazio] of [
    ["ranking === null", "Nenhuma busca com destino"],
    ["pontos === null", "pontos-pessoais-vazio"],
    ["naoAchados === null", "Nenhum pedido em aberto."],
    ["reportes === null", "Nenhum aviso em aberto."],
  ]) {
    const i = pg.indexOf(`{${nulo} ? (`);
    assert.ok(i > 0 && i < pg.indexOf(vazio), nulo);
  }
  assert.match(pg, /valor: ranking \? ranking\.reduce\(\(n, r\) => n \+ r\.total, 0\) : "—"/);
  assert.match(pg, /valor: naoAchados \? naoAchados\.length : "—"/);
  assert.match(pg, /data-testid="destinos-nao-leu"/);
});
