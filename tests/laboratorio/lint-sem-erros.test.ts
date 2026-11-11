import { test } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";

// Faixa D (laboratório verde): `npm run lint` tinha 3 erros na main (09/11) — 2 em /parceiros
// (aspas cruas no texto, react/no-unescaped-entities) e 1 no "Voltar ao site" do admin (setState
// síncrono dentro de useEffect, react-hooks/set-state-in-effect). Este guarda roda o ESLint do projeto
// só nesses arquivos e exige zero erros, para o lint da main não voltar a ficar vermelho por eles.
const ARQUIVOS = ["src/app/(public)/parceiros/page.tsx", "src/components/layout/voltar-ao-site.tsx"];

for (const arquivo of ARQUIVOS) {
  test(`lint sem erros: ${arquivo}`, async () => {
    const eslint = new ESLint();
    const [resultado] = await eslint.lintFiles([arquivo]);
    const erros = resultado.messages.filter((m) => m.severity === 2).map((m) => `${m.line}:${m.column} ${m.ruleId}`);
    assert.deepEqual(erros, []);
  });
}
