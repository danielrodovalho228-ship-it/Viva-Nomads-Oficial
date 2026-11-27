import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELOS_SUGERIDOS } from "./modelos-sugeridos.ts";
import { validarResposta } from "./regras.ts";

test("E665: cobre enxoval, camas, cozinha, documentos e regras", () => {
  assert.deepEqual(MODELOS_SUGERIDOS.map((m) => m.id), ["enxoval", "camas", "cozinha", "documentos", "regras"]);
});

test("E665: nenhum modelo traz valor, prazo, horário ou número (só [trecho] para o dono preencher)", () => {
  for (const m of MODELOS_SUGERIDOS) {
    assert.doesNotMatch(m.texto, /\d/, m.id);
    assert.doesNotMatch(m.texto, /R\$|reais|\bhoras?\b|\bdias?\b|\bsemanas?\b|\bmeses\b/i, m.id);
    assert.match(m.texto, /\[[^\]]+\]/, `${m.id}: tem o trecho a preencher`);
  }
});

test("E665: todo modelo passa na validação das respostas (sem contato/documento, dentro dos limites)", () => {
  for (const m of MODELOS_SUGERIDOS) assert.equal(validarResposta({ titulo: m.titulo, texto: m.texto }, 0).ok, true, m.id);
});

test("E665: a tela oferece um botão por modelo e só preenche o formulário (não salva)", async () => {
  const { readFileSync } = await import("node:fs");
  const tela = readFileSync("src/app/(dashboard)/dashboard/respostas-rapidas/respostas-tela.tsx", "utf8");
  assert.match(tela, /MODELOS_SUGERIDOS\.map/);
  assert.match(tela, /setEdicao\(\{ id: null, titulo: m\.titulo, texto: m\.texto \}\)/);
  assert.doesNotMatch(tela.split("MODELOS_SUGERIDOS.map")[1].split("</section>")[0], /salvarResposta/);
});
