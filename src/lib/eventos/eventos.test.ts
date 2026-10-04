/*
  Eventos anônimos: validação, origem (UTM) e plataforma.
  Roda: node --test src/lib/eventos/eventos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarEvento,
  origemDaUrl,
  origemDoCookie,
  origemParaCookie,
  plataformaDe,
  limparUtm,
  diaBR,
  TIPOS_EVENTO,
} from "./eventos.ts";

test("aceita os 10 tipos e recusa o resto", () => {
  assert.equal(TIPOS_EVENTO.length, 10);
  for (const tipo of TIPOS_EVENTO) assert.ok(validarEvento({ tipo }, ""));
  assert.equal(validarEvento({ tipo: "apagar" }, ""), null);
  assert.equal(validarEvento(null, ""), null);
  assert.equal(validarEvento("busca", ""), null);
});

test("imóvel só se for UUID; cidade normalizada", () => {
  const e = validarEvento(
    { tipo: "ver_anuncio", imovel_id: "A6600000-0000-0000-0000-000000000001", cidade: "  Uberlândia " },
    ""
  );
  assert.equal(e?.imovel_id, "a6600000-0000-0000-0000-000000000001");
  assert.equal(e?.cidade_chave, "uberlandia");
  const ruim = validarEvento({ tipo: "ver_anuncio", imovel_id: "1; drop table", cidade: "" }, "");
  assert.equal(ruim?.imovel_id, null);
  assert.equal(ruim?.cidade_chave, null);
});

test("plataforma: navegador comum é sempre web", () => {
  assert.equal(plataformaDe("Mozilla/5.0 (Linux; Android 14)", false), "web");
  assert.equal(plataformaDe("Mozilla/5.0 (Linux; Android 14) VivaNomadsApp", true), "android");
  assert.equal(plataformaDe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) VivaNomadsApp", true), "ios");
  assert.equal(validarEvento({ tipo: "busca", app: "sim" }, "Android")?.plataforma, "web");
});

test("UTM: limpa, corta e exige utm_source", () => {
  assert.equal(origemDaUrl("?utm_medium=cpc"), null);
  const o = origemDaUrl("?utm_source=Instagram&utm_medium=Story&utm_campaign=Lan%C3%A7amento<script>");
  assert.deepEqual(o, { source: "instagram", medium: "story", campaign: "lanamentoscript" });
  assert.equal(limparUtm("x".repeat(200))?.length, 80);
});

test("cookie de origem: ida e volta, e lixo vira vazio", () => {
  const o = { source: "google", medium: "cpc", campaign: null };
  assert.deepEqual(origemDoCookie(origemParaCookie(o)), o);
  assert.deepEqual(origemDoCookie("%%%"), { source: null, medium: null, campaign: null });
  assert.deepEqual(origemDoCookie(undefined), { source: null, medium: null, campaign: null });
});

test("dia da sessão no horário de Brasília", () => {
  // 02:00 UTC de 05/10 ainda é 04/10 em Brasília.
  assert.equal(diaBR(new Date("2026-10-05T02:00:00Z")), "2026-10-04");
});
