/*
  Frente 1, rodada 2 — achado 120 (média-alta): o resumo de alertas de busca salva lia as buscas sem conferir o erro.
  Na falha, toda pendência parecia de busca apagada/desligada e era marcada como enviada ("descartada"): os alertas se
  perdiam. Agora a leitura que falha não descarta nada (as pendências ficam para a próxima rodada).
  Roda: node --test src/lib/data/achado120-alerta-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./alerta-busca-servidor.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function enviarResumosAlertaBusca"));

test("alerta de busca: sem ler as buscas (ou as pendências), nada é descartado", () => {
  assert.match(fn, /const pend = erroLinhas \? \[\] :/);
  assert.match(fn, /if \(ids\.length && !erroBuscas\) \{/);
  assert.ok(fn.indexOf("if (ids.length && !erroBuscas)") < fn.indexOf('.update({ enviado_em: new Date().toISOString() })'), "a guarda vem antes do descarte");
});
