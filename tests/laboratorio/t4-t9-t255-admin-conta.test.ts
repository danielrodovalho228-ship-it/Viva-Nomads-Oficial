import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: t4/t9/t255 acompanham a casca e os textos atuais do admin e do painel do dono.
const ler = (f: string) => readFileSync(f, "utf8");
test("t4: o miolo do painel existe e o dono não tem aside (MENUS-5)", () => {
  assert.match(ler("src/components/layout/dashboard-shell.tsx"), /data-painel-main/);
  assert.match(ler("src/components/layout/dashboard-shell.tsx"), /\{!papelTopo && <aside/);
  const spec = ler("tests/e2e/specs/t4-fronteira-demo-real.spec.ts");
  assert.match(spec, /locator\("\[data-painel-main\]"\)\)\.toBeVisible\(\)/);
});
test("t9: o h1 da fila vem do rótulo do menu do admin", () => {
  assert.match(ler("src/config/menu-admin.ts"), /folha\("admin-documentos", "Documentos", "\/admin\/documentos"/);
  assert.match(ler("src/app/(dashboard)/admin/documentos/admin-documentos-client.tsx"), /title=\{rotuloDoAdmin\("\/admin\/documentos"\)\}/);
  assert.doesNotMatch(ler("tests/e2e/specs/t9-documentos.spec.ts"), /Documentos em confer/);
});
test("t255: o vazio da lista de pedidos do admin é 'Nenhum pedido nesta lista.'", () => {
  assert.match(ler("src/app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx"), /"Nenhum pedido nesta lista\."/);
  assert.doesNotMatch(ler("tests/e2e/specs/t255-admin-f15-f16-f18-f20.spec.ts"), /Nenhum pedido no sistema/);
});

test("t51 e t9 usam o título e o vazio atuais da fila de documentos", () => {
  assert.doesNotMatch(ler("tests/e2e/specs/t51-admin-padrao-caixa-socios.spec.ts"), /Documentos em confer/);
  assert.match(ler("tests/e2e/specs/t9-documentos.spec.ts"), /getByTestId\("fila-vazia"\)/);
  assert.match(ler("src/components/dashboard/primitives.tsx"), /data-testid="fila-vazia"/);
});

test("t4 não exige o nome por extenso no painel do dono (avatar curto)", () => {
  const spec = ler("tests/e2e/specs/t4-fronteira-demo-real.spec.ts");
  assert.doesNotMatch(spec, /toContainText\(primeiro\)/);
  assert.match(spec, /not\.toContainText\(\/Marcos Andrade\/\)/);
});

test("t9 tolera mais de um fila-vazia", () => {
  assert.match(ler("tests/e2e/specs/t9-documentos.spec.ts"), /getByTestId\("fila-vazia"\)\.first\(\)/);
});
