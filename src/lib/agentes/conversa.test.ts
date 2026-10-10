/* Roda: node --test src/lib/agentes/conversa.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirEnvio, dividirResposta, ehUrgente, estaNoFim, horaCurta, prioridadeDoTexto, textoFeito } from "./conversa.ts";

test("botão 'ir para o fim': só aparece quando a lista não está no fim", () => {
  assert.equal(estaNoFim({ scrollTop: 0, clientHeight: 400, scrollHeight: 1200 }), false);
  assert.equal(estaNoFim({ scrollTop: 800, clientHeight: 400, scrollHeight: 1200 }), true);
  assert.equal(estaNoFim({ scrollTop: 780, clientHeight: 400, scrollHeight: 1200 }), true); // dentro da margem
  assert.equal(estaNoFim({ scrollTop: 0, clientHeight: 400, scrollHeight: 300 }), true); // não rola
});

test("prioridade e urgência vêm do texto", () => {
  assert.equal(prioridadeDoTexto("P0 corrija o login"), "P0");
  assert.equal(prioridadeDoTexto("p3 ajuste"), "P3");
  assert.equal(prioridadeDoTexto("tipo P9 não existe"), null);
  assert.equal(ehUrgente("P1 corrigir a tela"), true);
  assert.equal(ehUrgente("faça isso agora"), true);
  assert.equal(ehUrgente("é urgente"), true);
  assert.equal(ehUrgente("P2 ajustar o texto do rodapé"), false);
  assert.equal(ehUrgente("corrija o texto quando der"), false);
});

test("o servidor decide: pergunta responde; ação urgente aciona; ação comum vira ordem", () => {
  assert.equal(decidirEnvio("como foi a ronda?", false), "pergunta");
  assert.equal(decidirEnvio("P0 corrija o botão", true), "executar");
  assert.equal(decidirEnvio("corrija o botão agora", true), "executar");
  assert.equal(decidirEnvio("corrija o botão", true), "ordem");
  // pergunta nunca dispara, mesmo escrita com "agora"
  assert.equal(decidirEnvio("o que você fez agora?", false), "pergunta");
});

test("hora em Brasília e texto do que foi feito", () => {
  assert.equal(horaCurta("2026-10-09T14:32:00Z"), "11:32");
  assert.equal(horaCurta("lixo"), "");
  assert.equal(textoFeito("Renato", true, "2026-10-09T14:32:00Z"), "Registrei e acionei Renato às 11:32.");
  assert.match(textoFeito("Renato", false, "2026-10-09T14:32:00Z"), /próxima ronda/);
});

test("resposta longa do agente: 5 linhas à vista e o resto em 'ver detalhes'", () => {
  const curta = "a\nb\nc";
  assert.deepEqual(dividirResposta(curta), { resumo: curta, detalhes: "" });
  const exata = "1\n2\n3\n4\n5";
  assert.equal(dividirResposta(exata).detalhes, "");
  const longa = "1\n2\n\n3\n4\n5\n6\n7";
  const r = dividirResposta(longa);
  assert.equal(r.resumo, "1\n2\n\n3\n4\n5");
  assert.equal(r.detalhes, "6\n7");
  // linhas vazias no fim não criam "detalhes" à toa
  assert.equal(dividirResposta("1\n2\n3\n4\n5\n\n\n").detalhes, "");
});

test("texto do agente: **negrito** e listas viram blocos; nada de HTML passa", async () => {
  const { lerTextoSimples } = await import("./conversa.ts");
  const b = lerTextoSimples("Resumo com **dois cadastros** hoje.\n\n- item **um**\n* item dois\n# Título\n<script>alert(1)</script> **x");
  assert.deepEqual(b[0], { tipo: "p", trechos: [{ texto: "Resumo com ", negrito: false }, { texto: "dois cadastros", negrito: true }, { texto: " hoje.", negrito: false }] });
  assert.deepEqual(b[1], { tipo: "li", trechos: [{ texto: "item ", negrito: false }, { texto: "um", negrito: true }] });
  assert.equal(b[2].tipo, "li");
  assert.deepEqual(b[3], { tipo: "p", trechos: [{ texto: "Título", negrito: false }] });
  // O texto perigoso continua texto (o React escapa); asterisco sem par não vira negrito.
  assert.deepEqual(b[4], { tipo: "p", trechos: [{ texto: "<script>alert(1)</script> **x", negrito: false }] });
  assert.ok(!b.some((x) => x.trechos.some((t) => t.negrito && t.texto.includes("*"))));
});
