/*
  E1033 passo 1 (ORDEM-DUET-212): UM helper único mede a área de toque REAL — pontos nas bordas da caixa 44×44 em volta do
  centro do controlo, conferidos com document.elementFromPoint (o que o dedo acerta), em vez de ler a altura do ::after
  (que a E960 mostrou ser enganosa: a classe alvo-toque só existe em tela de toque e o ::after "media" mesmo sem cobrir
  o controlo). Os 9 specs que mediam via ::after migram para o helper.
  Roda: node --test tests/laboratorio/e1033-area-toque-real.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { pontosDaCaixa, LADO_TOQUE } from "../e2e/fixtures/area-toque.ts";

test("o lado da caixa é 44 px", () => {
  assert.equal(LADO_TOQUE, 44);
});

test("os pontos: o centro, os 4 cantos e os 4 meios das bordas da caixa 44×44, 1 px para dentro", () => {
  const p = pontosDaCaixa(100, 200);
  assert.equal(p.length, 9);
  const xs = [...new Set(p.map((q) => q.x))].sort((a, b) => a - b);
  const ys = [...new Set(p.map((q) => q.y))].sort((a, b) => a - b);
  assert.deepEqual(xs, [79, 100, 121]);
  assert.deepEqual(ys, [179, 200, 221]);
  assert.ok(p.some((q) => q.onde === "centro" && q.x === 100 && q.y === 200));
  for (const onde of ["canto sup-esq", "canto sup-dir", "canto inf-esq", "canto inf-dir", "borda sup", "borda inf", "borda esq", "borda dir"])
    assert.ok(p.some((q) => q.onde === onde), onde);
});

test("o veredito usa o centro e os 4 meios das bordas; os cantos só informam (o hit-test do Chrome respeita o border-radius)", () => {
  const p = pontosDaCaixa(0, 0);
  const veredito = p.filter((q) => q.conta).map((q) => q.onde).sort();
  assert.deepEqual(veredito, ["borda dir", "borda esq", "borda inf", "borda sup", "centro"]);
  assert.equal(p.filter((q) => !q.conta).length, 4, "os 4 cantos ficam só como informação");
});

test("os 9 specs migrados usam o helper, e nenhum spec mede o alvo pelo ::after", () => {
  const dir = new URL("../e2e/specs/", import.meta.url);
  const viaAfter = readdirSync(dir).filter((f) => f.endsWith(".spec.ts")).filter((f) => /getComputedStyle\([^)]*["']::after["']\)/.test(readFileSync(new URL(f, dir), "utf8")));
  assert.deepEqual(viaAfter, [], `ainda medem pelo ::after: ${viaAfter.join(", ")}`);
  for (const f of ["t788-comparar-voltar-alvo", "t791-switch-alvo", "t792-orcamentos-filtros", "t793-simulador-prazos", "t794-carteira-link", "t795-inicio-verificacao", "t813-varredura-publica-toque", "t815-404-perfil-toque", "t817-cadastro-alvos-toque"]) {
    const src = readFileSync(new URL(`${f}.spec.ts`, dir), "utf8");
    assert.match(src, /from "\.\.\/fixtures\/area-toque"/, `${f} importa o helper`);
    assert.match(src, /areaDeToque\(/, `${f} usa areaDeToque`);
  }
});
