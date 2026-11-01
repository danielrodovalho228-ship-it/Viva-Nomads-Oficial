import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { progressoPasso, progressoQualificacao, textoQualificacao, textoRespondidas } from "./assistente-telas.ts";
import { TELAS_QUALIFICACAO, contarRespondidas } from "./qualificacao-conforto.ts";

test("E382 — as 3 respostas da 1ª tela movem a barra (antes ficava em 0)", () => {
  const r = { cama: true, apoio: true, ventilacao: "ar" } as const;
  const c = contarRespondidas(r);
  assert.equal(c.total, TELAS_QUALIFICACAO.flatMap((t) => t.perguntas).length);
  assert.equal(c.feitas, 3);
  assert.equal(progressoQualificacao(0, 5, 10), 0);
  assert.ok(progressoQualificacao(0, 5, 10, c.feitas / c.total) > 0);
  // Uma resposta já aparece; nunca passa do início do Passo 1.
  assert.ok(progressoQualificacao(0, 5, 10, 1 / 12) >= 1);
  assert.equal(progressoQualificacao(0, 5, 10, 1), progressoPasso(0, 10));
  // "Não tem" também é resposta; vazio não é.
  assert.equal(contarRespondidas({ cama: false, internet: "" }).feitas, 1);
});

test("E382 — o rodapé mostra as respostas numa 2ª linha; a 1ª segue 'Antes do Passo 1 · Qualificação N de 5'", () => {
  assert.equal(textoQualificacao(1), "Antes do Passo 1 · Qualificação 1 de 5");
  assert.equal(textoRespondidas({ feitas: 3, total: 12 }), "3 de 12 respondidas");
  assert.equal(textoRespondidas({ feitas: 0, total: 12 }), null);
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", import.meta.url), "utf8");
  assert.match(tela, /const respondidas = contarRespondidas\(p\.respostas\);/);
  assert.match(tela, /detalhe=\{resultado \? null : textoRespondidas\(respondidas\)\}/);
  assert.match(tela, /pct=\{progressoQualificacao\(resultado \? TOTAL_TELAS : p\.tela, TOTAL_TELAS, 10, respondidas\.feitas \/ respondidas\.total\)\}/);
  const rodape = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/rodape-assistente.tsx", import.meta.url), "utf8");
  assert.match(rodape, /data-testid="passo-detalhe"/);
});
