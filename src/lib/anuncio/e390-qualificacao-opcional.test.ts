import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUBTITULO_QUALIFICACAO, TELAS_QUALIFICACAO, rotuloAvancarQualificacao } from "./qualificacao-conforto.ts";

test("E390 — a etapa declara que é opcional e o botão nunca pula calado", () => {
  assert.match(SUBTITULO_QUALIFICACAO, /^Opcional: /);
  assert.match(SUBTITULO_QUALIFICACAO, /responder depois/);
  const tela1 = TELAS_QUALIFICACAO[0];
  assert.equal(rotuloAvancarQualificacao(tela1, {}), "Pular");
  assert.equal(rotuloAvancarQualificacao(tela1, { cama: false }), "Continuar");
  // Resposta de OUTRA tela não conta para esta.
  assert.equal(rotuloAvancarQualificacao(tela1, { agua: true }), "Pular");
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="qualificacao-opcional">\s*\{SUBTITULO_QUALIFICACAO\}/);
  assert.match(tela, /rotulo: rotuloAvancarQualificacao\(TELAS_QUALIFICACAO\[p\.tela\], p\.respostas\), onClick: \(\) => p\.onTela\(p\.tela \+ 1\), testid: "qualificacao-continuar"/);
});

test("E390 — rodapé a 360 px: o texto quebra em vez de ficar por baixo do botão", () => {
  const r = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/rodape-assistente.tsx", import.meta.url), "utf8");
  assert.match(r, /max-\[374px\]:whitespace-normal max-\[374px\]:leading-tight sm:text-sm" aria-live="polite" data-testid="passo-texto"/);
});
