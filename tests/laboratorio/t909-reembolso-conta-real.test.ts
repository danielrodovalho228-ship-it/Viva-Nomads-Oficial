import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Rodada completa 5eb1fad9 (42a48ade, 10/11): t909 entrava como MORADOR e esperava "reembolso-linha-desconto". Essa linha
// só existe no ReembolsoPreview, desenhado apenas no modo demonstração (useDashDemo: admin + NEXT_PUBLIC_MODO_DEMO_PAINEL).
// Conta real vê o ReembolsoReal (estado honesto). A spec confere o que a conta real vê; o desenho da linha segue guardado
// por src/app/(dashboard)/dashboard/reembolsos/linha-desconto-768.test.ts.
test("t909: a spec do morador confere o estado da conta real, não a linha do modo demonstração", () => {
  const pagina = readFileSync("src/app/(dashboard)/dashboard/reembolsos/page.tsx", "utf8");
  assert.match(pagina, /return demo \? <ReembolsoPreview \/> : <ReembolsoReal \/>;/);
  const real = pagina.slice(pagina.indexOf("function ReembolsoReal"), pagina.indexOf("function ReembolsoPreview"));
  assert.ok(!real.includes("reembolso-linha-desconto"), "a linha não existe para conta real");
  const titulo = real.match(/title="(A devolução[^"]+)"/)?.[1];
  assert.ok(titulo);
  const demo = readFileSync("src/lib/demo/demo-mode.tsx", "utf8");
  assert.match(demo, /on: admin && on/, "o modo demonstração é só do admin");

  const spec = readFileSync("tests/e2e/specs/t909-reembolso-linha-tablet.spec.ts", "utf8");
  assert.doesNotMatch(spec, /getByTestId\("reembolso-linha-desconto"\)\;\s*\n\s*await expect\(linha\)\.toBeVisible/);
  assert.ok(spec.includes(titulo!), `a spec confere "${titulo}"`);
  assert.match(spec, /getByTestId\("reembolso-linha-desconto"\)\)\.toHaveCount\(0\)/);
});
