import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Lab 17/10 (execuções bc631da3 e e8f49884): os specs que navegam pelo painel logado esperavam
 * `waitUntil: "networkidle"` e estouravam os 45 s do Playwright (t64 em 10 rotas seguidas, t40, t39, t46),
 * sem defeito de tela. "networkidle" nunca assenta quando o painel mantém uma conexão aberta e o prazo
 * vai embora esperando. Nesses specs a navegação espera "domcontentloaded" e a verificação é a asserção
 * com espera automática do próprio Playwright. A tela de login (/auth) fica fora: lá o formulário precisa
 * estar hidratado antes de preencher (inclusive /auth?senha=1, o "Entrar com senha" do Prompt 49).
 */
const SPECS = {
  "t64-telas-largas": "tests/e2e/specs/t64-telas-largas.spec.ts",
  "t40-novo-anuncio-fotos": "tests/e2e/specs/t40-novo-anuncio-fotos.spec.ts",
  "t39-app-ida-e-volta": "tests/e2e/specs/t39-app-ida-e-volta.spec.ts",
  "t46-modo-do-app": "tests/e2e/specs/t46-modo-do-app.spec.ts",
  // Lab 17/10 (b726ef6): mesmos 45 s estourados em t115 (painel), t140 (galeria) e t142 (bairros).
  "t115-importar-anuncio": "tests/e2e/specs/t115-importar-anuncio.spec.ts",
  "t140-galeria-lightbox": "tests/e2e/specs/t140-galeria-lightbox.spec.ts",
  "t142-bairros": "tests/e2e/specs/t142-bairros.spec.ts",
};

function navegacoesComNetworkidle(arquivo: string): string[] {
  return readFileSync(arquivo, "utf8")
    .split("\n")
    .filter((l) => /\.(goto|reload)\(/.test(l) && /networkidle/.test(l) && !/["']\/auth(\?[^"']*)?["']/.test(l))
    .map((l) => l.trim());
}

for (const [nome, arquivo] of Object.entries(SPECS)) {
  test(`${nome}: navegação do painel não espera networkidle`, () => {
    assert.deepEqual(navegacoesComNetworkidle(arquivo), []);
  });
}

test("t64: as rotas em sequência têm prazo próprio (test.slow) e esperam o <main>", () => {
  const src = readFileSync(SPECS["t64-telas-largas"], "utf8");
  assert.match(src, /test\.slow\(\)/);
  assert.match(src, /locator\("main"\)/);
});
