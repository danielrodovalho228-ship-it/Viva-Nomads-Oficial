import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Rodada completa 5eb1fad9 (42a48ade, 10/11): t431 "3. a 390 px: página do imóvel agrupa por categoria" gravava as
  proximidades pela chave de serviço e abria a página UMA vez; "perto-categorias" não aparecia. A página pública do
  imóvel guarda cópia por 60 s (F9: revalidate = 60) e a gravação direta no banco não chama revalidatePath — mesma
  causa do t439. A spec passa a recarregar até a cópia nova entrar (padrão t28/t74/t439), com folga de 120 s.
*/
test("t431: a página do imóvel tem cache de 60 s e só mostra os grupos com proximidades", () => {
  const pagina = readFileSync("src/app/(public)/imoveis/[id]/page.tsx", "utf8");
  assert.match(pagina, /export const revalidate = 60;/);
  const perto = readFileSync("src/components/property/location-nearby.tsx", "utf8");
  assert.match(perto, /hasProximities && \(/);
  assert.match(perto, /data-testid="perto-categorias"/);
});

test("t431: a spec recarrega a página até os grupos aparecerem", () => {
  const spec = readFileSync("tests/e2e/specs/t431-perto-a.spec.ts", "utf8");
  const teste3 = spec.slice(spec.indexOf("página do imóvel agrupa por categoria"));
  assert.match(teste3, /toPass\(\{[^}]*timeout: 120_000/);
  assert.match(teste3, /await page\.reload\(\{ waitUntil: "domcontentloaded" \}\);\s*await expect\(grupos\)\.toBeVisible\(\{ timeout: 5_000 \}\);/);
});
