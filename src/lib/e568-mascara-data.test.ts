/**
 * E568 (QA 04/11/2026): no "Pedir para morar", digitar a data num campo que JÁ tinha data corrompia o valor — "10/01/2027"
 * virava "00/12/027". A 1ª tecla esvaziava a data (o campo emite "" enquanto incompleta), o pai devolvia "" e a sincronização
 * "mudança de fora" reescrevia o texto com o vazio, apagando o "1"; o resto caía sobre o texto errado. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brParaIso, mascararData, textoAposMudancaDeFora } from "./data-digitada.ts";

/** Simula o campo: a cada tecla, máscara → emite o ISO (ou "") → o pai devolve o valor → sincronização. */
function digitar(inicial: string, teclas: string, valorInicial: string): string {
  let texto = inicial;
  let valor = valorInicial;
  for (const t of teclas) {
    texto = mascararData(texto + t);
    const emitido = brParaIso(texto) ?? "";
    if (emitido !== valor) {
      valor = emitido;
      texto = textoAposMudancaDeFora(texto, valor);
    }
  }
  return texto;
}

test("o caso do QA: campo com data, seleciona tudo e digita 10/01/2027 → 10/01/2027 (antes: 00/12/027)", () => {
  assert.equal(digitar("", "10/01/2027", "2026-12-05"), "10/01/2027");
  assert.equal(digitar("", "10012027", "2026-12-05"), "10/01/2027");
});

test("campo vazio: a digitação inteira passa sem perder tecla", () => {
  assert.equal(digitar("", "10/01/2027", ""), "10/01/2027");
});

test("mudança de fora de verdade (calendário, rascunho, a outra caixa) segue atualizando o texto", () => {
  assert.equal(textoAposMudancaDeFora("", "2027-01-10"), "10/01/2027");
  assert.equal(textoAposMudancaDeFora("05/12/2026", "2027-01-10"), "10/01/2027");
  // o pai limpou uma data completa → o campo esvazia
  assert.equal(textoAposMudancaDeFora("05/12/2026", ""), "");
  // o texto já é a data do valor → fica como está
  assert.equal(textoAposMudancaDeFora("10/01/2027", "2027-01-10"), "10/01/2027");
});

test("o que a pessoa está digitando (incompleto) não é apagado quando o valor vira vazio", () => {
  assert.equal(textoAposMudancaDeFora("1", ""), "1");
  assert.equal(textoAposMudancaDeFora("10/01/20", ""), "10/01/20");
  // data inexistente digitada (31/02) também fica, para o aviso de data inválida (E520) aparecer
  assert.equal(textoAposMudancaDeFora("31/02/2027", ""), "31/02/2027");
});

test("o campo de data com máscara (computador) usa a regra — vale para todo CampoData/CampoDataHora", () => {
  const src = readFileSync(new URL("../components/ui/campo-data.tsx", import.meta.url), "utf8");
  assert.match(src, /setTexto\(\(t\) => textoAposMudancaDeFora\(t, value\)\)/);
  assert.doesNotMatch(src, /if \(brParaIso\(texto\) !== value\) setTexto\(isoParaBr\(value\)\);/);
});
