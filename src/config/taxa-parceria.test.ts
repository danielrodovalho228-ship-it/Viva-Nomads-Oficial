import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_TAXA_PARCERIA, REGRA_TAXA_PARCERIA, TEXTO_QUEM_RECEBE_TAXA_PARCERIA, reais } from "./taxa-parceria.ts";
import { TAXA_PARCERIA_TEXTO } from "../lib/atendimento/parceiros-texto.ts";

// Ordem 39cc7c00: 3 faixas (R$ 40 / 60 / 80) em /parceiros e /parceiros/fotografos, valores numa constante só.
test("constante tem as 3 faixas da decisão do Daniel", () => {
  assert.deepEqual(FAIXAS_TAXA_PARCERIA.map((f) => [f.rotulo, f.valor]), [
    ["Até 20 fotos", 40], ["21 a 40 fotos", 60], ["Acima de 40 fotos", 80],
  ]);
  assert.match(REGRA_TAXA_PARCERIA, /só quando você aceita o pedido/);
  assert.match(REGRA_TAXA_PARCERIA, /pago direto pelo proprietário a você/);
  assert.match(REGRA_TAXA_PARCERIA, /sem mensalidade e sem exclusividade/);
});

test("o texto do atendimento bate com a constante", () => {
  for (const f of FAIXAS_TAXA_PARCERIA) assert.ok(TAXA_PARCERIA_TEXTO.includes(reais(f.valor)), f.rotulo);
});

test("as 2 rotas públicas e o /admin usam o componente/constante (nenhum valor solto)", () => {
  const ler = (p: string) => readFileSync(p, "utf8");
  for (const p of ["src/app/(public)/parceiros/page.tsx", "src/app/(public)/parceiros/fotografos/page.tsx"]) {
    assert.match(ler(p), /<FaixasTaxaParceria/, p);
  }
  assert.match(ler("src/app/(dashboard)/admin/fotografos/page.tsx"), /FAIXAS_TAXA_PARCERIA\.map/);
  assert.doesNotMatch(ler("src/app/(dashboard)/admin/fotografos/page.tsx"), /R\$ 40/);
  const comp = ler("src/components/parceiros/faixas-taxa.tsx");
  assert.match(comp, /FAIXAS_TAXA_PARCERIA\.map/);
  assert.doesNotMatch(comp, /R\$ ?\d/);
});

test("Prompt 29, item 12: diz quem paga e quem recebe; sem 'intermediação' nem 'comissão'", () => {
  assert.equal(
    TEXTO_QUEM_RECEBE_TAXA_PARCERIA,
    "Taxa de parceria (R$ 40/60/80, por faixa de fotos): paga pelo fotógrafo à Viva Nomads ao aceitar o pedido. O serviço é pago direto do proprietário ao fotógrafo; a Viva não recebe esse valor."
  );
  assert.match(REGRA_TAXA_PARCERIA, /à Viva Nomads/);
  assert.match(REGRA_TAXA_PARCERIA, /a Viva não recebe esse valor/);
  for (const t of [TEXTO_QUEM_RECEBE_TAXA_PARCERIA, REGRA_TAXA_PARCERIA]) assert.doesNotMatch(t, /intermedia|comiss/i);
  assert.deepEqual(FAIXAS_TAXA_PARCERIA.map((f) => f.valor), [40, 60, 80], "a regra não mudou");
});
