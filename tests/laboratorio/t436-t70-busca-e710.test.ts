import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: t436/t70 acompanham o layout atual da busca (E710: pílulas em dois grupos; E659: margem de 24 px).
const barra = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");
const t436 = readFileSync("tests/e2e/specs/t436-busca-clean-e82.spec.ts", "utf8");
const t70 = readFileSync("tests/e2e/specs/t70-busca-split.spec.ts", "utf8");

test("t436 lê as pílulas nos dois grupos da barra, na ordem do documento", () => {
  assert.match(barra, /data-testid="pilulas-filtros"/);
  assert.match(barra, /data-testid="pilulas-acoes"/);
  assert.doesNotMatch(t436, /:scope > \[data-testid\]/);
  const ordem = JSON.parse(t436.match(/const ORDEM = (\[[^\]]*\])/)![1]) as string[];
  let ultimo = -1;
  for (const id of ordem) {
    const i = id === "pilula-nivel" || id === "pilula-datas" || id === "pilula-local" || id === "pilula-tipo" || id === "pilula-preco" || id === "pilula-ordenar" ? barra.indexOf(`pilula(${JSON.stringify(id.replace("pilula-", ""))})`) : barra.indexOf(`data-testid="${id}"`);
    assert.ok(i > ultimo, `${id} fora de ordem no código da barra`);
    ultimo = i;
  }
});
test("t70 segue a spec (decisão do chat principal): proporções, margens do E659 e destaque, sem afrouxar", () => {
  const t70 = readFileSync("tests/e2e/specs/t70-busca-split.spec.ts", "utf8");
  assert.match(t70, /toBeGreaterThanOrEqual\(0\.53\)/);
  assert.match(t70, /toBeGreaterThanOrEqual\(0\.4\)/);
  assert.match(t70, /\.toBe\(1440 - 24\)/);
  assert.match(readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8"), /lg:w-\[58%\]/);
});
