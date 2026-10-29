import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab d63d1acd: t160 (link "Favoritos" no topo público) e t266 (5 telas do painel pela gaveta "Abrir menu") esperavam
// telas anteriores ao E176 (PUBLICO-A) e ao MENUS-5. Este teste prende as duas specs ao código atual.
const ler = (f: string) => readFileSync(f, "utf8");
const spec = (f: string) => ler(`tests/e2e/specs/${f}`);

test("t160: o topo público não tem Favoritos, então a spec não cobra o link", () => {
  const nav = ler("src/lib/constants.ts").match(/export const PUBLIC_NAV = \[([\s\S]*?)\]/)?.[1] ?? "";
  assert.deepEqual([...nav.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Imóveis", "Anunciar", "Empresas"]);
  const t160 = spec("t160-favoritos-pagina.spec.ts");
  assert.doesNotMatch(t160, /const link = page\.getByRole\("link", \{ name: \/Favoritos\/ \}\)/);
  assert.match(t160, /getByRole\("link", \{ name: \/Favoritos\/ \}\)\)\.toHaveCount\(0\)/);
});

test("t266: o dono vai às Ferramentas pelo link do Início e a Contratos pela aba — não há gaveta nem Ferramentas na Conta", () => {
  assert.match(ler("src/components/painel/inicio-dono.tsx"), /data-testid="inicio-dono-todas-ferramentas"/);
  assert.match(ler("src/components/layout/topo-dono.tsx"), /data-testid=\{`aba-\$\{px\}-\$\{a\.id\}`\}/);
  assert.match(ler("src/components/layout/mobile-tab-bar.tsx"), /"Navegação principal"/);
  const t266 = spec("t266-painel-42.spec.ts");
  assert.doesNotMatch(t266, /name: "Abrir menu"|conta-dono-ferramentas|vn-menu-aberto|Menu do painel/);
  assert.ok(t266.includes('getByTestId("inicio-dono-todas-ferramentas")'));
  assert.ok(t266.includes('nav[aria-label="Navegação principal"] a[href="/dashboard/contratos"]'));
});
