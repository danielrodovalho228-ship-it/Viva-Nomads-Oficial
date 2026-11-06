/*
  E609: "Medir a internet no imóvel" chegava com "Quarto principal" já escolhido — uma escolha que o proprietário nunca
  fez aparecia como dele. Agora o ponto começa sem escolha (no cadastro, na edição e na conferência) e o "Medir" só
  libera depois de escolher. Quem abre a medição a partir de um item do nível ("Meça agora" do quarto principal ou do
  ponto de trabalho) já escolheu ao tocar no item: lá o ponto vem do item.
  Roda: node --test src/lib/anuncio/e609-medir-sem-premarca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const m = readFileSync("src/components/anuncio/medir-internet.tsx", "utf8");

test("E609: sem ponto pré-escolhido por padrão", () => {
  assert.doesNotMatch(m, /pontoInicial = "quarto_principal"/);
  assert.match(m, /useState<PontoMedicao \| null>\(pontoInicial \?\? null\)/);
});

test("E609: o Medir espera a escolha do ponto e diz por quê", () => {
  assert.match(m, /disabled=\{ocupado \|\| !ponto \|\| estado\.restantesHoje <= 0\}/);
  assert.match(m, /data-testid="medir-internet-escolha-ponto"/);
  assert.match(m, /if \(!estado\?\.ok \|\| !ponto\) return;/);
});

test("E609: cadastro, edição e conferência não passam ponto; só o item do nível passa", () => {
  const usos = [
    ["src/components/anuncio/blocos-cadastro.tsx", false],
    ["src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", false],
    ["src/components/contrato/conferencia-contrato.tsx", false],
    ["src/components/niveis/medir-no-imovel.tsx", true],
    ["src/app/(dashboard)/dashboard/imoveis/[id]/nivel/medir-no-nivel.tsx", true],
  ] as const;
  for (const [arq, passa] of usos) {
    const s = readFileSync(arq, "utf8");
    const tag = s.slice(s.indexOf("<MedirInternet"), s.indexOf("/>", s.indexOf("<MedirInternet")));
    assert.equal(/pontoInicial=/.test(tag), passa, arq);
  }
});
