import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GESTOR_MIN_IMOVEIS_VALIDADOS, textoElegibilidadeGestor } from "../../src/lib/planos/gestor.ts";

// Rodada completa do lab 10/11: t656 esperava "Liberado. Fale com a Viva para ativar." (E224). Com a regra nova de
// comissão (E564: o Gestor é a taxa de 4% por contrato, sem assinatura) a linha da Conta › Plano vem de
// textoElegibilidadeGestor. Os textos da spec têm de ser exatamente os que a função devolve.
test("t656: os dois textos que a spec espera são os de textoElegibilidadeGestor", () => {
  const spec = readFileSync("tests/e2e/specs/t656-e224-plano-gestor.spec.ts", "utf8");
  const n = GESTOR_MIN_IMOVEIS_VALIDADOS;
  const semImovel = textoElegibilidadeGestor({ elegivel: false, imoveisValidados: 0, faltam: n });
  const liberado = textoElegibilidadeGestor({ elegivel: true, imoveisValidados: 0, faltam: 0 });
  assert.ok(spec.includes(JSON.stringify(semImovel)), `a spec não espera: ${semImovel}`);
  assert.ok(spec.includes(JSON.stringify(liberado)), `a spec não espera: ${liberado}`);
  assert.doesNotMatch(spec, /toHaveText\("Liberado\. Fale com a Viva para ativar\."/);
});
