/*
  E981 — Nível do imóvel: desmarcar (ou remarcar) "O imóvel tem" num item que JÁ tem foto não salvava. O salvarItemNivel
  fazia upsert repetindo o foto_path gravado, mas sem foto_origem; a 0242 exige origem em toda linha com foto
  (nivel_itens_foto_com_origem), e o Postgres valida a linha proposta do INSERT antes de resolver o ON CONFLICT: o upsert
  era recusado (23514) e a tela dizia "Não foi possível salvar agora". O t295 (teste 2) falha por isso.
  Regra: sem foto nova, numa linha que já existe, grava-se SÓ a declaração (update) — a foto e a origem dela não entram.
  Roda: node --test src/lib/niveis/e981-desmarcar-item-com-foto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposDaDeclaracao, gravaSoADeclaracao } from "./gravar-item.ts";

test("só a declaração (update) quando a linha já existe e não chega foto nova", () => {
  assert.equal(gravaSoADeclaracao({ existeLinha: true, novaFoto: false }), true);
  // Foto nova: a linha inteira vai por upsert, com a origem 'camera' (como antes).
  assert.equal(gravaSoADeclaracao({ existeLinha: true, novaFoto: true }), false);
  // Item ainda sem linha: upsert (sem foto, não há origem a exigir; com foto, leva a origem).
  assert.equal(gravaSoADeclaracao({ existeLinha: false, novaFoto: false }), false);
  assert.equal(gravaSoADeclaracao({ existeLinha: false, novaFoto: true }), false);
});

test("o update escreve só os três campos da declaração — nunca a foto nem a origem", () => {
  const agora = "2026-11-16T08:00:00.000Z";
  for (const declarado of [false, true]) {
    const campos = camposDaDeclaracao({ declarado, uid: "99999999-2222-4333-8444-555555555555", agora });
    assert.deepEqual(campos, { declarado, declarado_por: "99999999-2222-4333-8444-555555555555", declarado_em: agora });
    assert.deepEqual(Object.keys(campos).sort(), ["declarado", "declarado_em", "declarado_por"]);
  }
});

test("a ação: update da declaração quando é o caso; senão, o upsert de sempre (com a origem 'camera' na foto nova)", () => {
  const a = readFileSync(new URL("../data/nivel-actions.ts", import.meta.url), "utf8");
  const corpo = a.slice(a.indexOf("export async function salvarItemNivel"), a.indexOf("DETECTA-B"));
  // A existência da linha vem da leitura que a ação já faz (e que, se falhar, interrompe o salvar).
  assert.match(corpo, /const soDeclaracao = gravaSoADeclaracao\(\{ existeLinha: !!atual, novaFoto: !!novaFoto \}\);/);
  assert.match(corpo, /soDeclaracao\s*\? await c\.admin\.from\("nivel_itens"\)\.update\(camposDaDeclaracao\(\{ declarado, uid: c\.uid, agora \}\)\)\.eq\("property_id", propertyId\)\.eq\("chave", chave\)\s*: await c\.admin\.from\("nivel_itens"\)\.upsert\(/);
  // O upsert não mudou: a foto nova continua entrando com a origem 'camera', de volta para análise.
  assert.match(corpo, /foto_origem: "camera"/);
  assert.match(corpo, /foto_status: "pendente"/);
  assert.match(corpo, /\{ onConflict: "property_id,chave" \}/);
  // A regra "declarar exige foto" continua antes de qualquer gravação.
  assert.ok(corpo.indexOf("if (declarado && !foto) return") < corpo.indexOf("gravaSoADeclaracao("));
  // A falha da gravação continua respondendo à tela (e registrando o código do banco).
  assert.match(corpo, /console\.error\("\[salvarItemNivel\]", error\.code, error\.message\)/);
});

test("a restrição que o upsert violava continua na 0242 (a correção é na gravação, não no banco)", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0242_foto_na_hora.sql", import.meta.url), "utf8");
  assert.match(sql, /nivel_itens_foto_com_origem check \(foto_path is null or foto_origem is not null\)/);
});
