/*
  Convivência no padrão E56 e no desenho da tela 06 dos mockups aprovados: cada regra (silêncio, fumo, festas, visitas)
  com o seu toggle. Roda: node --test src/lib/anuncio/regras-casa-form.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { completudeBlocos } from "./bloco-opcional.ts";
import { normalizarRegrasCasa } from "./regras-casa.ts";
import { desligarRegra, estadosConvivencia, formDeRegrasCasa, payloadDeRegrasCasa, regraTemDados } from "./regras-casa-form.ts";

test("sem regra salva, as 4 nascem desligadas; regra salva nasce ligada (tela 06: visitas aberta, fumo e festas fechados)", () => {
  assert.deepEqual(formDeRegrasCasa(null).ligados, { silencio: false, fumo: false, festas: false, visitas: false });
  const f = formDeRegrasCasa({ visitas: { permitidas: true, ate: "22:00", pernoite: false } });
  assert.deepEqual(f.ligados, { silencio: false, fumo: false, festas: false, visitas: true });
  assert.equal(f.visitasAte, "22:00");
});

test("só as regras ligadas vão ao servidor; escolha numa regra desligada não vale", () => {
  const f = { ...formDeRegrasCasa(null), fumo: "proibido" as const, festas: "proibido" as const };
  assert.equal(normalizarRegrasCasa(payloadDeRegrasCasa(f)), null, "nada ligado = nada definido");
  const g = { ...f, ligados: { ...f.ligados, festas: true } };
  assert.deepEqual(payloadDeRegrasCasa(g), { festas: "proibido" });
});

test("desligar com escolha pede confirmação (tem dados); confirmado, a regra volta vazia e sai do envio", () => {
  const f = formDeRegrasCasa({ festas: "proibido", silencio: { inicio: "22:00", fim: "08:00" } });
  assert.equal(regraTemDados(f, "festas"), true);
  assert.equal(regraTemDados(f, "fumo"), false);
  const off = desligarRegra(f, "festas");
  assert.equal(off.ligados.festas, false);
  assert.equal(off.festas, "");
  assert.deepEqual(payloadDeRegrasCasa(off), { silencio: { inicio: "22:00", fim: "08:00" } });
});

test("medidor: regra ligada sem escolha falta; desligada não se aplica", () => {
  const f = formDeRegrasCasa({ festas: "permitido" });
  const comFumoVazio = { ...f, ligados: { ...f.ligados, fumo: true } };
  assert.deepEqual(completudeBlocos(estadosConvivencia(comFumoVazio)), { feitos: 1, faltam: 1, naoSeAplica: 2, pct: 50 });
});
