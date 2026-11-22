import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoElegibilidadeGestor } from "../../src/lib/planos/gestor.ts";

// E744 (lote 2, rodada 42767013537): specs que cobravam texto/dado já mudado no produto.
const ler = (f: string) => readFileSync(`tests/e2e/specs/${f}`, "utf8");

test("t656: o texto esperado do Plano Gestor é o da função do produto (0 de 20)", () => {
  const atual = textoElegibilidadeGestor({ elegivel: false, imoveisValidados: 0, faltam: 20 });
  assert.ok(ler("t656-e224-plano-gestor.spec.ts").includes(atual), atual);
});
test("t315: a rota de avaliação diz 'selo “vistoriado”' como no produto", () => {
  assert.match(readFileSync("src/lib/vistoria/telas-exibicao.ts", "utf8"), /Avaliação: selo “vistoriado” por 12 meses/);
  assert.ok(ler("t315-telas-avaliacao-dono-62a.spec.ts").includes("Avaliação: selo “vistoriado” por 12 meses"));
});
test("t304 e t486: avaliações inseridas com os três critérios e 'recomendaria' (trigger do E679)", () => {
  for (const f of ["t304-airbnb-exibicao-61a.spec.ts", "t486-e174b-selo-vinculo.spec.ts"]) {
    const s = ler(f);
    assert.match(s, /\.\.\.criteriosDaAvaliacao\("inquilino"\)/, f);
    assert.match(s, /from "\.\.\/fixtures\/avaliacao-criterios"/, f);
  }
});
test("t593: o nome de teste da moradora contém 'Visitante'; a spec confere só o rótulo vazio", () => {
  const s = ler("t593-e211-visita-do-dono.spec.ts");
  assert.doesNotMatch(s, /\.not\.toContainText\("Visitante"\)/);
  assert.match(s, /not\.toHaveText\(\/Quem vem:/);
});
test("t287: a confirmação do destino é achada pelo texto (há outro role=status no formulário)", () => {
  assert.match(ler("t287-admin-destinos-salvar.spec.ts"), /getByRole\("status"\)\.filter\(\{ hasText: NOME \}\)/);
});
test("t875: o aviso 'já respondeu à sua candidatura' aparece em dois lugares; a spec usa o primeiro", () => {
  assert.match(ler("t875-e581-candidatura-repetida.spec.ts"), /getByText\(\/já respondeu à sua candidatura\/\)\.first\(\)/);
});
