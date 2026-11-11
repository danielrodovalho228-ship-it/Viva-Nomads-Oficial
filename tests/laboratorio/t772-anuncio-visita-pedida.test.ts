import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Rodada completa 5eb1fad9 (42a48ade, 10/11): t772 esperava "visita-video-abrir" no anúncio ANTES da confirmação,
// com a visita já pedida no banco. Desde o E329/E411 o anúncio com visita em aberto troca o botão pelo estado
// (data-testid `${prefixo}-${estado}` → "visita-video-pedida") e não oferece pedir outra igual.
test("t772: antes da confirmação a spec espera o estado 'pedida' que o anúncio desenha", () => {
  const spec = readFileSync("tests/e2e/specs/t772-e329-visita-confirmada.spec.ts", "utf8");
  const inicio = spec.indexOf("// Antes da confirmação");
  const antes = inicio < 0 ? "" : spec.slice(inicio, spec.indexOf("// (a) o dono confirma", inicio));
  assert.ok(antes.length > 0, "a spec tem o trecho antes da confirmação");
  assert.doesNotMatch(antes, /getByTestId\("visita-video-abrir"\)\.first\(\)\)\.toBeAttached/, "com visita pedida o botão de pedir não existe");
  assert.match(antes, /getByTestId\("visita-video-pedida"\)/);
  const tela = readFileSync("src/components/property/visita-video.tsx", "utf8");
  assert.match(tela, /prefixo: "visita-video"/);
  assert.match(tela, /data-testid=\{`\$\{tBotao\.prefixo\}-\$\{estado\}`\}/);
});
