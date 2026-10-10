/*
  "Resumo e ações" e sugestão com fatos oficiais (seguros, pré-lançamento).
  Roda: node --test src/lib/atendimento/resumo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { acoesPorRegra, lerResumo, notaResumo, resumoDaNota, resumoPorRegra, sugestaoPorRegra, SYSTEM_RESUMO } from "./resumo.ts";
import { fontes } from "./viva-prompt.ts";
import { validarResposta } from "./viva-regras.ts";

const VN101 = "Sou proprietário e quero entender como funciona o Caução. Vocês oferecem seguro para o imóvel?";

test("caso VN-000101: ações de seguros (Thiago) e Caução; visitante ganha convite para cadastro", () => {
  const a = acoesPorRegra(VN101, true);
  assert.ok(a.some((x) => /seguros/.test(x.texto) && x.para === "thiago"));
  assert.ok(a.some((x) => /Caução/.test(x.texto)));
  assert.ok(a.some((x) => /Convidar para criar a conta/.test(x.texto)));
  assert.ok(!acoesPorRegra(VN101, false).some((x) => /Convidar/.test(x.texto)));
  assert.ok(a.length <= 6);
});

test("sugestão do caso VN-000101: não oferece seguro, conversa com seguradoras, convida e diz pré-lançamento — sem inventar", () => {
  const s = sugestaoPorRegra(VN101, "Ana", true);
  assert.match(s, /ainda NÃO oferece seguro/);
  assert.match(s, /conversando com seguradoras/);
  assert.match(s, /criar a conta gratuita/);
  assert.match(s, /lançamento oficial é em 2027/);
  assert.match(s, /Caução/);
  assert.doesNotMatch(s, /apartamento/i);
  assert.ok(validarResposta(s).ok, "passa nas regras de texto da Viva");
  // Quem já tem conta não recebe convite para cadastro.
  const comConta = sugestaoPorRegra(VN101, "Paulo", false);
  assert.match(comConta, /avisaremos você por aqui/);
  assert.doesNotMatch(comConta, /criar a conta/);
});

test("IA: JSON saneado — sem e-mail/telefone/CPF, no máx. 6 ações, agente só da lista", () => {
  const r = lerResumo(
    'blá {"resumo":"Ana (ana@x.com, 34 99999-1234, 123.456.789-00) quer saber do Caução","acoes":[{"texto":"Responder","para":"thiago"},{"texto":"Ligar","para":"hacker"},{"texto":"a"},{"texto":"b"},{"texto":"c"},{"texto":"d"},{"texto":"e"}]} fim',
    "ia",
    new Date("2026-10-07T21:00:00Z")
  )!;
  assert.doesNotMatch(r.resumo, /@|9999|456/);
  assert.equal(r.acoes.length, 6);
  assert.equal(r.acoes[0].para, "thiago");
  assert.equal(r.acoes[1].para, null);
  assert.equal(lerResumo("sem json"), null);
  assert.equal(lerResumo('{"resumo":""}'), null);
});

test("nota interna guarda e devolve o resumo (não gasta IA a cada abertura)", () => {
  const r = resumoPorRegra(VN101, false, new Date("2026-10-07T21:00:00Z"));
  const de = resumoDaNota(notaResumo(r))!;
  assert.equal(de.resumo, r.resumo);
  assert.deepEqual(de.acoes, r.acoes);
  assert.equal(de.origem, "regras");
  assert.equal(resumoDaNota("nota qualquer"), null);
});

test("fatos oficiais chegam à Viva (chat, chamados, sugestão e resumo)", () => {
  const f = fontes();
  assert.match(f, /## Situação da Viva hoje \(fonte oficial\)/);
  assert.match(f, /ainda NÃO oferece seguro/);
  assert.match(f, /2027/);
  assert.match(f, /nunca invente/);
  assert.match(SYSTEM_RESUMO, /SEM nome completo, e-mail, telefone, CPF/);
});

test("preço que a Viva informa é a regra única de 12%, sem planos nem faixas (ordem 3914d70c)", () => {
  const f = fontes();
  assert.match(f, /A Viva cobra 12% por contrato fechado\. Sem mensalidade\./);
  assert.match(f, /Sem mensalidade/);
  assert.doesNotMatch(f, /sem mensalidade, comissão|\/mês|até \d+ anúncio/);
  assert.doesNotMatch(f, /Essencial: |Profissional: |Gestor: |Gratuito: /);
  assert.doesNotMatch(f, /\b(10|8|6|4)% de um aluguel/);
});
