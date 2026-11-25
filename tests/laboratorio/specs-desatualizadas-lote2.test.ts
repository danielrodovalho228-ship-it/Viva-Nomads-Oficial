import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoTaxaNaConta } from "../../src/lib/planos/gestor.ts";

// E744 (lote 2, rodada 42767013537): specs que cobravam texto/dado já mudado no produto.
// Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): t656 — a função do produto que dá o texto de Conta › Plano é
// textoTaxaNaConta (a taxa de hoje da conta); textoElegibilidadeGestor (a meta do Plano Gestor, "0 de 20") saiu.
const ler = (f: string) => readFileSync(`tests/e2e/specs/${f}`, "utf8");

test("t656: o texto esperado de Conta › Plano é o da função do produto (078: a taxa da conta sem imóvel ativo; antes, 'Plano Gestor… 0 de 20')", () => {
  // 078 (Daniel, 16/11/2026): antes textoElegibilidadeGestor({ elegivel: false, imoveisValidados: 0, faltam: 20 }) — "Plano Gestor: taxa
  // de 4% com 20 imóveis ativos (…). Você tem 0; faltam 20." Agora o texto é o da taxa da conta, para o mesmo cenário da spec
  // (proprietário sem imóvel ativo: primeira faixa, 12%), e a spec não espera mais o texto do Plano Gestor.
  const atual = textoTaxaNaConta({ taxa: 0.12, origem: "faixa", imoveisAtivos: 0 });
  assert.match(atual, /^Sua taxa de serviço hoje é de 12%\. Quanto mais imóveis ativos, menor a taxa: /);
  const spec = ler("t656-e224-plano-gestor.spec.ts");
  assert.ok(spec.includes(atual), atual);
  assert.doesNotMatch(spec, /toHaveText\([^)]*Plano Gestor/);
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
