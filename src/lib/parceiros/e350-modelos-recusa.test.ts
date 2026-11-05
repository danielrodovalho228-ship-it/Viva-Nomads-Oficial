/* Roda: node --test src/lib/parceiros/e350-modelos-recusa.test.ts
  E350 (decisão do Daniel, 01/11): os modelos de "Motivo da recusa" da aprovação de parceiro correspondem um a um ao contexto
  da recusa de PARCERIA — um por item do checklist do admin (identidade, documento, área, categoria) e um para pedido
  incompleto —, cada um com o motivo e o próximo passo escritos para o parceiro. No celular, os modelos aparecem como opções
  na própria tela (texto inteiro), não como a lista nativa longa que cobria a tela.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ITENS_CHECKLIST, MODELOS_RECUSA_PARCERIA, MOTIVOS_RECUSA_PARCERIA } from "./regras.ts";

test("E350: um modelo por item do checklist, mais o de pedido incompleto, na mesma ordem", () => {
  assert.deepEqual(MODELOS_RECUSA_PARCERIA.map((m) => m.chave), [...ITENS_CHECKLIST.map((i) => i.chave), "incompleto"]);
});

test("E350: cada modelo diz o motivo e o próximo passo, no vocabulário da casa", () => {
  for (const m of MODELOS_RECUSA_PARCERIA) {
    assert.ok(m.rotulo.length >= 8 && m.rotulo.length <= 40, m.rotulo);
    assert.ok(m.texto.length >= 60 && m.texto.length <= 500, m.texto);
    assert.match(m.texto, /novo pedido de parceria/, `${m.chave}: próximo passo`);
    assert.doesNotMatch(m.texto, /comiss|h[oó]spede|reserva|aluguel|temporada/i, m.chave);
  }
  assert.match(MODELOS_RECUSA_PARCERIA[1].texto, /CPF ou CNPJ/);
  assert.match(MODELOS_RECUSA_PARCERIA[2].texto, /cidade|região/);
  assert.match(MODELOS_RECUSA_PARCERIA[3].texto, /portfólio/);
  // Os textos continuam disponíveis como lista simples (quem lia MOTIVOS_RECUSA_PARCERIA).
  assert.deepEqual(MOTIVOS_RECUSA_PARCERIA, MODELOS_RECUSA_PARCERIA.map((m) => m.texto));
});

test("E350: a ficha mostra os modelos como opções na tela (sem <select>), e escolher preenche o motivo", () => {
  const s = readFileSync(new URL("../../app/(dashboard)/admin/parceiros/fichas.tsx", import.meta.url), "utf8");
  const bloco = s.slice(s.indexOf("Motivo da recusa (obrigatório)") - 400, s.indexOf('data-testid="ficha-motivo"'));
  assert.doesNotMatch(bloco, /<select/);
  assert.match(bloco, /<fieldset[^>]*data-testid="ficha-modelo-recusa"/);
  assert.match(bloco, /MODELOS_RECUSA_PARCERIA\.map/);
  assert.match(bloco, /type="radio"/);
  assert.match(bloco, /data-testid=\{`ficha-modelo-recusa-\$\{m\.chave\}`\}/);
  assert.match(bloco, /setMotivo\(m\.texto\)/);
});
