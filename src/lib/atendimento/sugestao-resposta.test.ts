/*
  E217 (L-70) — a resposta manual do chamado nunca depende da sugestão automática.
  Roda: node --test src/lib/atendimento/sugestao-resposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_SUGESTAO_INDISPONIVEL, podeEnviarResposta, sugestaoComPrazo, sugestaoVaiParaACaixa } from "./sugestao-resposta.ts";

const cliente = readFileSync(new URL("../../app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx", import.meta.url), "utf8");

test("o envio manual só depende do texto e de não haver envio em curso", () => {
  assert.equal(podeEnviarResposta("Olá, tudo certo.", false), true);
  assert.equal(podeEnviarResposta("   ", false), false);
  assert.equal(podeEnviarResposta("Olá", true), false);
});

test("sugestão: ok passa o valor; erro, rejeição e demora viram falha", async () => {
  assert.deepEqual(await sugestaoComPrazo(async () => ({ ok: true as const, texto: "Oi" })), { ok: true, valor: { ok: true, texto: "Oi" } });
  assert.deepEqual(await sugestaoComPrazo(async () => ({ ok: false as const, error: "A Viva está desligada." })), { ok: false, motivo: "erro", error: "A Viva está desligada." });
  assert.deepEqual(await sugestaoComPrazo(() => Promise.reject(new Error("rede"))), { ok: false, motivo: "conexao" });
  const nunca = () => new Promise<{ ok: true }>(() => {});
  assert.deepEqual(await sugestaoComPrazo(nunca, 20), { ok: false, motivo: "prazo" });
});

test("a sugestão que chega depois não apaga o que o atendente escreveu (a pedida por ele substitui)", () => {
  assert.equal(sugestaoVaiParaACaixa("", false), true);
  assert.equal(sugestaoVaiParaACaixa("Minha resposta", false), false);
  assert.equal(sugestaoVaiParaACaixa("Minha resposta", true), true);
});

test("tela: botão pelo texto, aviso discreto na falha, sem erro vermelho da sugestão", () => {
  assert.equal(AVISO_SUGESTAO_INDISPONIVEL, "Sugestão indisponível no momento — você pode responder normalmente.");
  assert.match(cliente, /disabled=\{!podeEnviarResposta\(texto, ocupado\)\}/);
  assert.match(cliente, /data-testid="sugestao-indisponivel"/);
  assert.match(cliente, /sugestaoComPrazo\(\(\) => sugerirResposta\(c\.id\)\)/);
  assert.doesNotMatch(cliente, /if \(!r\.ok\) return setErro\(r\.error\)/);
  assert.match(cliente, /data-testid="dica-caixa-vazia"/);
});
