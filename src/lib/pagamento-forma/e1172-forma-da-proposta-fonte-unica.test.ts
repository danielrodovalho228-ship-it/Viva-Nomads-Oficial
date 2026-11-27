/*
  E1172 — a forma de pagamento da proposta (E647) é conferida numa FONTE ÚNICA.
  Antes: a mesma conta (normalizar a escolha do anúncio, a forma inicial, validar) estava escrita em dois sítios do
  `propostas-actions.ts` (enviarProposta e responderProposta), e a trava do E647 só exigia UM `validarFormaNaProposta(`:
  se um dos dois blocos perdesse a validação, a trava continuava verde.
  Depois: `formaDaProposta` (puro, em regras.ts) faz a conta num lugar só, e as duas ações chamam-na; nenhuma valida à mão.
  Tudo atrás de FORMA_PAGAMENTO_DONO_ATIVA (desligada). Sem migração.
  Roda: node --test src/lib/pagamento-forma/e1172-forma-da-proposta-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formaDaProposta } from "./regras.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => fonteSemComentarios(readFileSync(new URL(p, import.meta.url), "utf8"));
const ambos = { ate_90: "ambos", de_91: "ambos" };
const BLOQUEADO = /91 a 180 dias a forma de pagamento é o mensal/;
const recusaBloqueada = (r: ReturnType<typeof formaDaProposta>, msg?: string) => {
  assert.equal(r.ok, false, msg);
  assert.match(r.ok ? "" : r.erro, BLOQUEADO, msg);
};

test("a regra pura: o dono propõe a outra; o morador só o que o anúncio aceita", () => {
  assert.deepEqual(formaDaProposta({ pedida: "mensal", anterior: null, escolhaDoAnuncio: { ate_90: "bloco", de_91: "mensal" }, dias: 60, quem: "owner" }), { ok: true, forma: "mensal" });
  const morador = formaDaProposta({ pedida: "mensal", anterior: "bloco", escolhaDoAnuncio: { ate_90: "bloco", de_91: "mensal" }, dias: 60, quem: "tenant" });
  assert.equal(morador.ok, false);
  assert.deepEqual(formaDaProposta({ pedida: "mensal", anterior: "bloco", escolhaDoAnuncio: ambos, dias: 60, quem: "tenant" }), { ok: true, forma: "mensal" });
});

test("a regra pura: 91–180 dias com bloco fica bloqueado; fora da faixa é recusado; sem forma, recusa", () => {
  recusaBloqueada(formaDaProposta({ pedida: "bloco", anterior: null, escolhaDoAnuncio: ambos, dias: 120, quem: "owner" }));
  const fora = formaDaProposta({ pedida: "mensal", anterior: null, escolhaDoAnuncio: ambos, dias: 200, quem: "owner" });
  assert.equal(fora.ok, false);
  assert.match(fora.ok ? "" : fora.erro, /30 a 180 dias/);
  assert.equal(formaDaProposta({ pedida: "trimestral", anterior: null, escolhaDoAnuncio: ambos, dias: 60, quem: "owner" }).ok, false);
});

test("a regra pura: sem pedida vale a anterior se couber nos dias; sem anterior, a forma inicial do anúncio", () => {
  assert.deepEqual(formaDaProposta({ pedida: undefined, anterior: "mensal", escolhaDoAnuncio: ambos, dias: 60, quem: "tenant" }), { ok: true, forma: "mensal" });
  recusaBloqueada(formaDaProposta({ pedida: undefined, anterior: "bloco", escolhaDoAnuncio: ambos, dias: 120, quem: "owner" }), "a forma que vinha precisa caber nos novos dias");
  assert.deepEqual(formaDaProposta({ pedida: undefined, anterior: null, escolhaDoAnuncio: { ate_90: "bloco", de_91: "mensal" }, dias: 60, quem: "owner" }), { ok: true, forma: "bloco" });
  assert.deepEqual(formaDaProposta({ pedida: undefined, anterior: null, escolhaDoAnuncio: null, dias: 120, quem: "owner" }), { ok: true, forma: "mensal" }, "sem preferência no anúncio, o padrão recomendado");
});

test("a fiação: as duas ações chamam a fonte única, uma vez cada, e nenhuma valida à mão", () => {
  const acoes = ler("../data/propostas-actions.ts");
  assert.equal((acoes.match(/formaDaProposta\(/g) ?? []).length, 2, "uma chamada em cada ação");
  assert.doesNotMatch(acoes, /validarFormaNaProposta\(/, "nenhuma validação direta fora da fonte única");
  for (const nome of ["enviarProposta", "responderProposta"]) {
    const i = acoes.indexOf(`export async function ${nome}(`);
    assert.ok(i >= 0, nome);
    const corpo = acoes.slice(i, acoes.indexOf("\nexport ", i + 1));
    assert.match(corpo, /formaDaProposta\(/, `${nome} chama a fonte única`);
  }
});
