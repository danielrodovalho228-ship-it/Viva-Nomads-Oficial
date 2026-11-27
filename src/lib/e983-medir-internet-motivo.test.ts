/*
  E983 (t388, resto do E609) — "Medir a internet agora" ficava desabilitado sem o motivo ligado ao botão: o aviso
  "Escolha onde você está medindo…" (e o do limite do dia) existia, mas solto; leitor de tela e a varredura (f) viam um
  botão cinza mudo. Agora o motivo vem de uma função pura e o botão aponta para ele (aria-describedby).
  Roda: node --test src/lib/e983-medir-internet-motivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { travaDoMedir } from "./internet-medida.ts";

test("E983 — o motivo da trava: medindo > escolher o ponto > limite do dia; liberado = null", () => {
  assert.equal(travaDoMedir({ ocupado: true, ponto: null, restantesHoje: 0 }), "medindo");
  assert.equal(travaDoMedir({ ocupado: false, ponto: null, restantesHoje: 3 }), "escolher_ponto");
  assert.equal(travaDoMedir({ ocupado: false, ponto: "sala", restantesHoje: 0 }), "limite_do_dia");
  assert.equal(travaDoMedir({ ocupado: false, ponto: "sala", restantesHoje: 3 }), null);
});

test("E983 — o botão usa a trava e aponta para o texto do motivo (aria-describedby + data-trava-motivo)", () => {
  const s = readFileSync("src/components/anuncio/medir-internet.tsx", "utf8");
  assert.match(s, /disabled=\{trava !== null\} aria-busy=\{trava === "medindo" \|\| undefined\} aria-describedby=\{motivoDaTrava\}/);
  assert.match(s, /id=\{idMotivoPonto\}[^>]*data-trava-motivo="escolher_ponto"/);
  assert.match(s, /id=\{idMotivoLimite\}[^>]*data-trava-motivo="limite_do_dia"/);
  assert.doesNotMatch(s, /disabled=\{ocupado \|\| !ponto \|\| estado\.restantesHoje <= 0\}/);
});
