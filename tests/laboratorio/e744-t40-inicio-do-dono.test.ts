/*
  Roda: node --test tests/laboratorio/e744-t40-inicio-do-dono.test.ts
  E744 (teste velho): o t40 clicava em "Novo anúncio" no Início do dono, que desde o PROP-6 (#1483, 29/10) não tem esse
  link. A correção NÃO apaga o caso: ele passa a cobrar o que o Início tem hoje (o botão do bloco principal) e que o link
  antigo não voltou; o caminho até o passo 1 continua cobrado a partir de Meus imóveis.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync("tests/e2e/specs/t40-novo-anuncio-fotos.spec.ts", "utf8");

test("t40: o caso do Início do dono cobra o botão do bloco principal e a ausência do link antigo", () => {
  assert.match(spec, /getByTestId\("inicio-dono-botao"\)/);
  assert.match(spec, /getByRole\("link", \{ name: \/Novo anúncio\/ \}\)\)\.toHaveCount\(0\)/);
  assert.match(spec, /PROP-6/);
});

test("t40: o caminho 'Novo anúncio' → passo 1 continua cobrado a partir de Meus imóveis, e nenhum caso foi pulado", () => {
  assert.match(spec, /for \(const origem of \["\/dashboard\/imoveis"\]\)/);
  assert.match(spec, /await noPasso\(page, "tipo"\);/);
  // O único pulo do arquivo é o que já existia ("conta de teste já tem imóveis"); a correção não acrescentou nenhum.
  assert.equal((spec.match(/test\.(skip|fixme|fail)\(/g) ?? []).length, 1);
  assert.match(spec, /test\.skip\(\(await vazio\.count\(\)\) === 0, "conta de teste já tem imóveis"\);/);
  assert.doesNotMatch(spec, /\.only\(/);
});

test("o produto: o Início do dono tem o botão do bloco principal e não tem 'Novo anúncio'", () => {
  const tela = readFileSync("src/components/painel/inicio-dono.tsx", "utf8");
  assert.match(tela, /data-testid="inicio-dono-botao"/);
  assert.doesNotMatch(tela, /Novo anúncio/);
  assert.match(readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8"), /Novo anúncio/);
});
