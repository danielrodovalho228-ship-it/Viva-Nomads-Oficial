/*
  Frente 1, rodada 3 — achado 122 (média-alta): a sincronia do calendário importado (iCal do Airbnb/Booking, a cada 3 h)
  lia as datas já importadas sem conferir o erro. Na falha, o plano tratava o calendário como vazio e inseria todas as
  datas de novo (bloqueios em dobro no anúncio). Agora a leitura que falha não mexe em nada.
  Roda: node --test src/lib/calendario/achado122-sincronia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./importar-servidor.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function sincronizarImportacao"), src.indexOf("const COLUNAS ="));

test("sincronia: sem ler as datas atuais, não apaga nem insere", () => {
  const guarda = fn.indexOf("if (erroAtuais) return { ok: false,");
  assert.ok(guarda > 0);
  assert.ok(guarda < fn.indexOf("planoDeSincronia("), "antes do plano");
  assert.ok(guarda < fn.indexOf('.from("property_blocks")\n      .insert('), "antes de inserir");
});
