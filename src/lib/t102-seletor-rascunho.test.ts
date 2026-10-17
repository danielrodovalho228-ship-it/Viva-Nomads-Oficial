import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab 70f874c: t102 estourava 45 s porque /Continuar|Retomar/ casava com o "Continuar" do rodapé do cadastro.
test("t102: o botão de retomar rascunho é buscado dentro do aviso, não por regex solta", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.ok(!/name:\s*\/Continuar\|Retomar\//.test(spec));
  assert.match(spec, /Você tem um anúncio em andamento/);
});

// Lab 8b32a4e: o bloco "preco-sugerido" não aparecia em 10 s — isVisible() não espera e o aviso do rascunho
// chega depois do networkidle (getLatestDraft é assíncrono). A spec precisa ESPERAR o aviso ou o bloco.
test("t102: espera o aviso de rascunho ou o bloco do preço antes de decidir (isVisible não espera)", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.ok(!/isVisible\(\)\.catch/.test(spec));
  const espera = spec.search(/retomar\.or\(bloco\)[^;]*waitFor/);
  assert.ok(espera > 0 && espera < spec.indexOf("retomar.isVisible("));
  assert.match(spec, /toBeVisible\(\{\s*timeout:\s*\d{5,}/);
});
