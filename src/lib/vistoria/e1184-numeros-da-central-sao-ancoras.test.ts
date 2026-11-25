/*
  E1184 (ORDENS-DUET 824, 827 e 830; Central). Em /admin/avaliadores, quem tocava num dos oito números de "Para
  decidir" logo que a página aparecia ficava, em cerca de 1 em cada 10 vezes, com o endereço na âncora e a tela parada
  no topo — e o segundo toque não resolvia. Medido no laboratório a 390 px: 9 toques perdidos em 110 com o toque
  imediato; 0 em 80 quando se espera a página assentar.
  Os números eram links do roteador a apontar para uma secção da própria página: no primeiro instante, a navegação
  ficava atrás do trabalho de ligar a página e a rolagem já não era aplicada.
  A cura: os oito números saem como âncora simples — quem leva a tela até à secção é o navegador (0 perdidos em 160).
  Âmbito fechado (ORDEM-830): só estes oito. A barra fixa do imóvel e os componentes partilhados ficam como estão — na
  barra a âncora simples piora (a página cresce por cima do cartão de preço e a rolagem pára antes).
  Roda: node --test src/lib/vistoria/e1184-numeros-da-central-sao-ancoras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";
import { contagemDecisoes } from "./telas-exibicao.ts";
import { contagemContestacoes } from "./telas-laudo.ts";

const ADMIN = fonteSemComentarios(readFileSync("src/app/(dashboard)/admin/avaliadores/page.tsx", "utf8"));
const numeros = [
  ...contagemDecisoes({ credenciamentos: [], semAvaliador: 0, recusasAusencias: 0, cidadesProntas: 0, cidades: 0 }),
  ...contagemContestacoes({ contestacoes: 0, devolucoes: 0, laudosAtrasados: 0, auditoria: 0 }),
];

test("E1184 (1): os números de 'Para decidir' saem como âncora simples — não como link do roteador", () => {
  assert.match(ADMIN, /<a href=\{n\.ancora\} className="[^"]*" data-testid=\{`decidir-numero-\$\{n\.chave\}`\} data-valor=\{n\.valor\}>/, "os números de 'Para decidir' saem como âncora simples");
  assert.doesNotMatch(ADMIN, /<Link href=\{n\.ancora\}/, "os números voltaram a ser links do roteador");
  // A página monta os oito a partir das duas contagens, e é essa lista que desenha.
  assert.match(ADMIN, /const numeros = \[\s*\.\.\.numerosBase,\s*\.\.\.contagemContestacoes\(/);
  assert.match(ADMIN, /\{numeros\.map\(\(n\) => \(/);
});

test("E1184 (2): os oito números apontam, cada um, para uma secção que existe na própria página", () => {
  assert.equal(numeros.length, 8);
  assert.deepEqual(
    numeros.map((n) => [n.chave, n.ancora]),
    [
      ["credenciamentos", "#credenciamento"],
      ["sem-avaliador", "#sem-avaliador"],
      ["recusas", "#recusas"],
      ["chave", "#chave"],
      ["contestacoes", "#contestacoes"],
      ["devolucoes", "#contestacoes"],
      ["laudos-atrasados", "#contestacoes"],
      ["auditoria", "#auditoria"],
    ],
  );
  for (const n of numeros) {
    // Âncora pura: só assim o navegador a resolve sozinho, sem o roteador.
    assert.match(n.ancora, /^#[a-z-]+$/, `${n.chave}: "${n.ancora}" não é uma âncora da própria página`);
    assert.match(ADMIN, new RegExp(`<(?:Secao|Panel) id="${n.ancora.slice(1)}" `), `${n.chave}: a secção ${n.ancora} não existe na página`);
  }
});
