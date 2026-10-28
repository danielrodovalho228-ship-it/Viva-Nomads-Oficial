import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abasDoPapelPainel } from "../../src/config/abas-painel.ts";
import { blocoPrincipalDono } from "../../src/lib/painel/inicio-dono.ts";

// Lab 891e28dd: t262 (avatar da Conta resolvido em 2 elementos), t265 (barra do visitante com 5) e t265/t266 (Início do
// dono novo) esperavam telas anteriores ao MENUS-5/PROP-6. Este teste prende as specs ao código atual.
const ler = (f: string) => readFileSync(`tests/e2e/specs/${f}`, "utf8");

test("t262: o avatar da Conta é procurado dentro do topo do celular (o desktop tem outro com o mesmo testid)", () => {
  const spec = ler("t262-detalhe-imovel-41.spec.ts");
  assert.doesNotMatch(spec, /page\.getByTestId\("conta-(morador|dono|parceiro)-celular"\)/);
  for (const p of ["morador", "dono", "parceiro"]) assert.ok(spec.includes(`getByTestId("topo-celular").getByTestId("conta-${p}-celular")`), p);
});

test("t265: a barra do visitante tem tantas abas quanto o morador sem contrato", () => {
  const n = abasDoPapelPainel("morador", { comContrato: false }).length;
  // E176 (D1): a "Estadia" do morador aparece sempre — 5 abas, com ou sem contrato.
  assert.equal(n, 5);
  assert.match(ler("t265-folga-fim-rodape.spec.ts"), /getByRole\("link"\)\)\.toHaveCount\(5\);\s*\n\s*\}\);\s*\n\s*\}\n\s*\}\);/);
});

test("t265/t266: o Início do dono novo é 'Anuncie seu primeiro imóvel' com o primário 'Anunciar meu imóvel'", () => {
  const bloco = blocoPrincipalDono({ temAnuncio: false, rascunho: null, decisoes: [], fotoAnuncio: null });
  assert.equal(bloco.titulo, "Anuncie seu primeiro imóvel");
  assert.equal(bloco.botao.rotulo, "Anunciar meu imóvel");
  for (const f of ["t265-folga-fim-rodape.spec.ts", "t266-painel-42.spec.ts"]) {
    const spec = ler(f);
    assert.ok(spec.includes("Anuncie seu primeiro imóvel"), f);
    assert.ok(spec.includes("Anunciar meu imóvel"), f);
    assert.doesNotMatch(spec, /toHaveText\(\/Cadastrar meu imóvel\/\)|name: "Nada pede sua decisão hoje"/, f);
  }
});
