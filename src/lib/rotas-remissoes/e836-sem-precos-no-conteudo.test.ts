import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIAS, textoDoGuia } from "../guias/guias.ts";
import { fontes, SYSTEM_VIVA } from "../atendimento/viva-prompt.ts";
import { CENARIOS } from "../atendimento/viva-cenarios.ts";

/* E836: /precos está suspensa (redireciona à home). O guia de precificação e o que a Viva responde não remetem a ela —
   a frase vive sem a remissão morta. (O artigo "Quanto custa anunciar?" já saiu no #3820.) */
test("o guia de precificação não remete a /precos e traz a escada de taxas no lugar", () => {
  for (const g of GUIAS) assert.doesNotMatch(textoDoGuia(g), /\/precos|\/planos/, g.slug);
  const t = GUIAS.map(textoDoGuia).join("\n");
  assert.match(t, /Quanto mais imóveis ativos, menor a taxa/);
});

test("o que a Viva responde (fontes, sistema e cenários) não manda a /precos", () => {
  assert.doesNotMatch(fontes(), /\/precos/);
  assert.doesNotMatch(Array.isArray(SYSTEM_VIVA) ? SYSTEM_VIVA.join("\n") : String(SYSTEM_VIVA), /\/precos/);
  assert.doesNotMatch(JSON.stringify(CENARIOS), /\/precos/);
});
