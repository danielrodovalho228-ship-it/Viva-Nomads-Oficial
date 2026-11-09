import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: t280/t365/t489 acompanham o menu da Conta (E176) e o menu público com a chave de preços (E563).
const ler = (f: string) => readFileSync(f, "utf8");
test("t365 e t280: Notificações e Avaliações moram fora de /dashboard/conta/*", () => {
  assert.match(ler("src/config/menu-por-papel.ts"), /href: "\/dashboard\/avaliacoes"/);
  assert.match(ler("next.config.ts"), /source: "\/dashboard\/conta\/notificacoes", destination: "\/dashboard\/notificacoes"/);
  assert.match(ler("tests/e2e/specs/t365-conta-a1-casca-perfil.spec.ts"), /s === "avaliacoes" \? "\/dashboard\/avaliacoes"/);
  assert.match(ler("tests/e2e/specs/t280-conta-unica-43.spec.ts"), /const hrefConta = /);
});
test("t489: 'Planos' só no menu público com a chave de preços ligada", () => {
  assert.match(ler("src/config/precos-visivel.ts"), /comPortasDePrecos/);
  const s = ler("tests/e2e/specs/t489-e176-menus.spec.ts");
  assert.match(s, /NEXT_PUBLIC_PRECOS_VISIVEL === "1"/);
  assert.doesNotMatch(s, /"Parceiros", "Planos"\]\);/);
});

test("t355/t361: o selo do cabeçalho é o botão da Conta (conta-<px>), não o chip papel-ativo", () => {
  assert.match(ler("src/components/layout/topo-dono.tsx"), /`conta-\$\{p\.px\}`/);
  assert.doesNotMatch(ler("tests/e2e/specs/t355-conta-a-perfil-espelho.spec.ts"), /"papel-ativo"\]:visible \[data-rosto/);
  assert.doesNotMatch(ler("tests/e2e/specs/t361-conta-a-correcoes-qa.spec.ts"), /"papel-ativo"\]:visible img/);
  assert.match(ler("src/components/ui/avatar.tsx"), /data-rosto=\{rosto\.tipo\}/);
});

test("t355/t365: papel-ativo não é esperado no /dashboard do dono; Ajuda fica fora do menu da Conta (E493)", () => {
  assert.doesNotMatch(ler("tests/e2e/specs/t355-conta-a-perfil-espelho.spec.ts"), /goto\("\/dashboard"[^\n]*\n[^\n]*papel-ativo/);
  assert.match(ler("tests/e2e/specs/t365-conta-a1-casca-perfil.spec.ts"), /s !== "ajuda"/);
});
