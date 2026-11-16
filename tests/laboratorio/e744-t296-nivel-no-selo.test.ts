/*
  E744, passo 5 (15/11/2026) — t296, teste 1 (último verde: 23/10).
  O teste cobrava o nível de conforto abrindo a linha de fatos do cartão (`cartao-sintese` começando por "Essencial ·").
  Decisões registradas: desde o E416 (05/11) o nível é selo sobre a foto e saiu da linha de fatos; o E626 (06/11) fixou a pílula
  do nível entre os selos; o E899 (13/11) manteve (`src/lib/cartao-modelo.ts`: "o nível é selo da foto desde o E416").
  O teste segue cobrando o nível no cartão pelo selo (`card-nivel`) e passa a cobrar a regra de hoje na linha de fatos: ela
  não repete o nível.

  Roda: node --test tests/laboratorio/e744-t296-nivel-no-selo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modeloDoCartao } from "../../src/lib/cartao-modelo.ts";
import { itensSintese } from "../../src/lib/cartao-sintese.ts";
import { SAMPLE_PROPERTIES } from "../../src/lib/properties.ts";

const t296 = readFileSync("tests/e2e/specs/t296-niveis-exibicao-59-1.spec.ts", "utf8");

test("E744 t296: a regra do produto — a linha de fatos do cartão não traz o nível (E416, E626, E899)", () => {
  const comNivel = SAMPLE_PROPERTIES.filter((p) => itensSintese(p).some((i) => i.chave === "nivel"));
  assert.ok(comNivel.length > 0, "há anúncio de exemplo com nível para a regra valer de verdade");
  for (const p of comNivel) {
    assert.equal(modeloDoCartao(p).sintese.some((i) => i.chave === "nivel"), false, `${p.id}: o nível não entra na linha de fatos do cartão`);
  }
});

test("E744 t296: o teste 1 cobra o nível pelo selo da foto e a linha de fatos sem o nível", () => {
  const i = t296.indexOf('test("1. ');
  assert.ok(i > 0, "o teste 1 existe");
  const corpo = t296.slice(i, t296.indexOf('test("2. ', i));
  assert.match(corpo, /getByTestId\("card-nivel"\)\)\.toHaveText\(rotulo/, "o nível continua cobrado no cartão, pelo selo");
  assert.match(corpo, /getByTestId\("cartao-sintese"\)\)\.not\.toContainText\(rotulo\)/, "a linha de fatos não repete o nível");
  assert.doesNotMatch(corpo, /cartao-sintese"\)\)\.toContainText\(new RegExp\(`\^\$\{rotulo\}/, "a cobrança antiga (nível abrindo a linha de fatos) saiu");
});

test("t296, teste 4: a queda de nível é cobrada na faixa de alerta do Início do dono (PROP-6), com texto, prazo e destino", () => {
  const spec = readFileSync("tests/e2e/specs/t296-niveis-exibicao-59-1.spec.ts", "utf8");
  assert.match(spec, /const linha = page\.getByTestId\("inicio-dono-alerta"\);/);
  assert.match(spec, /caiu de Premium para Conforto: corrija Ar-condicionado em todos os quartos/);
  assert.match(spec, /Corrija até/);
  assert.match(spec, /toHaveAttribute\("href", `\/dashboard\/contratos\/\$\{ids\.contrato\}#pendencias-conforto`\)/);
  // O produto: a faixa mostra o texto e o prazo da pendência mais urgente e leva ao destino dela.
  const tela = readFileSync("src/components/painel/inicio-dono.tsx", "utf8");
  assert.match(tela, /data-testid="inicio-dono-alerta"/);
  assert.match(tela, /href=\{alerta\.href\}/);
  assert.match(tela, /\{alerta\.texto\}/);
  assert.match(tela, /alerta\.prazoTexto/);
});
