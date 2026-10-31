/*
  Conferência de entrada/saída sem nenhum item: a frase diz o que falta e o que fazer, conforme a vez de quem lê
  (antes: sempre "Nenhum item registrado ainda."). Roda: node --test src/lib/conferencia-vazia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoConferenciaVazia } from "./conferencia.ts";

test("parte que ainda pode registrar: o próximo passo (Adicionar item, com foto) e o que a outra parte faz", () => {
  for (const parte of ["proprietario", "inquilino"] as const) {
    const t = textoConferenciaVazia({ tipo: "entrada", parte, travada: false });
    assert.match(t, /^Ninguém registrou cômodos ainda\./);
    assert.match(t, /"Adicionar item"/);
    assert.match(t, /com foto/);
    assert.match(t, /confirma ou contesta/);
  }
});

test("conferência travada: diz qual (entrada ou saída) e que nada foi registrado, sem convidar a registrar", () => {
  assert.equal(textoConferenciaVazia({ tipo: "entrada", parte: "inquilino", travada: true }), "Nenhum cômodo foi registrado nesta conferência de entrada.");
  assert.equal(textoConferenciaVazia({ tipo: "saida", parte: "proprietario", travada: true }), "Nenhum cômodo foi registrado nesta conferência de saída.");
});

test("quem não é parte (leitura): só o estado, sem ação", () => {
  assert.equal(textoConferenciaVazia({ tipo: "saida", parte: null, travada: false }), "Nenhum cômodo registrado ainda na conferência de saída.");
});

test("a tela usa a frase da regra; a frase genérica antiga não volta", () => {
  const tela = readFileSync(new URL("../components/contrato/conferencia-contrato.tsx", import.meta.url), "utf8");
  assert.match(tela, /\{textoConferenciaVazia\(\{ tipo, parte, travada \}\)\}/);
  assert.match(tela, /data-testid=\{`conferencia-\$\{tipo\}-vazia`\}/);
  assert.doesNotMatch(tela, /Nenhum item registrado ainda\./);
});
