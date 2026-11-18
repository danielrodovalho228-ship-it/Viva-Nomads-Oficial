/*
  E744, passo 7 (15/11/2026) — t318, teste 2 (nunca teve registro verde em lab_execucoes).
  O teste cobrava a regra antiga do PAPEL-B: morador que abre /dashboard/imoveis TROCA para Proprietário e GRAVA
  `profiles.papel_ativo`. Decisões registradas: E548 (QA 04/11) e E653 (QA 06/11) — o papel nunca muda sozinho. Abrir uma página
  de área não troca nem grava: a página se desenha pela URL e, ao sair dela, o painel volta ao papel escolhido
  (`src/components/papel/sincronizar-papel.tsx`, `src/lib/papel/papel-ativo.ts` `gravacaoPorArea`, `docs/e653-papel-casca-estavel.md`).
  O teste passa a cobrar a regra de hoje: na página do dono o selo mostra Proprietário, o banco continua "morador", e as
  páginas comuns seguintes voltam ao papel escolhido.

  Roda: node --test tests/laboratorio/e744-t318-papel-nao-muda-sozinho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gravacaoPorArea } from "../../src/lib/papel/papel-ativo.ts";

const t318 = readFileSync("tests/e2e/specs/t318-papel-ativo-fonte-unica.spec.ts", "utf8");

test("E744 t318: a regra do produto — abrir uma página de área nunca grava o papel; só o 1º acesso grava o modo (E653)", () => {
  for (const papel of ["morador", "proprietario", "parceiro"] as const) assert.equal(gravacaoPorArea(papel, false), "nada");
});

test("E744 t318: o teste 2 cobra que a página do dono NÃO grava o papel e que as páginas comuns voltam ao papel escolhido", () => {
  const i = t318.indexOf('test("2. ');
  assert.ok(i > 0, "o teste 2 existe");
  const corpo = t318.slice(i, t318.indexOf('test("3. ', i));
  // Na página do dono o selo mostra Proprietário (a página se desenha pela URL)…
  assert.match(corpo, /\["\/dashboard\/imoveis", "proprietario"\]/);
  // …e o banco continua com o papel escolhido.
  assert.match(corpo, /rota === "\/dashboard\/imoveis"[\s\S]{0,400}expect\(await gravado\(\), [^)]*\)\.toBe\("morador"\)/);
  assert.doesNotMatch(corpo, /poll\(gravado[^)]*\)\.toBe\("proprietario"\)/, "a cobrança antiga (troca e grava) saiu");
  // Depois da página do dono, as páginas comuns voltam ao papel escolhido (morador), não ficam em Proprietário.
  const depois = corpo.slice(corpo.indexOf('["/dashboard/imoveis", "proprietario"]'));
  assert.doesNotMatch(depois.slice(40), /\["\/dashboard[^"]*", "proprietario"\]/, "nenhuma página comum fica em Proprietário depois");
  assert.match(depois, /\["\/dashboard\/conta", "morador"\]/);
  // O fim do roteiro segue cobrando o papel gravado.
  assert.match(corpo, /expect\.poll\(gravado, \{ timeout: 20_000 \}\)\.toBe\("morador"\)/);
});
