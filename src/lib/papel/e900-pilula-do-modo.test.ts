/*
  E900 — o painel diz em que modo a pessoa está: pílula segmentada no cabeçalho (ícone + palavra + cor por modo), em
  todas as telas do painel; um toque troca; quem tem um papel só vê o selo, sem interruptor.
  Roda: node --test src/lib/papel/e900-pilula-do-modo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { papeisDaPilula, pilulaDoModo } from "./pilula-do-modo.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E900: os modos oferecidos são os papéis que a conta tem, na ordem Morador · Proprietário · Parceiro", () => {
  assert.deepEqual(papeisDaPilula({ ativo: "morador", temImovel: false, parceiroAprovado: false }), ["morador"]);
  assert.deepEqual(papeisDaPilula({ ativo: "morador", temImovel: true, parceiroAprovado: false }), ["morador", "proprietario"]);
  assert.deepEqual(papeisDaPilula({ ativo: "proprietario", temImovel: true, parceiroAprovado: true }), ["morador", "proprietario", "parceiro"]);
  assert.deepEqual(papeisDaPilula({ ativo: "morador", temImovel: false, parceiroAprovado: true }), ["morador", "parceiro"]);
});

test("E900: o modo em uso aparece sempre, mesmo sem o papel derivado (dono que ainda não anunciou)", () => {
  assert.deepEqual(papeisDaPilula({ ativo: "proprietario", temImovel: false, parceiroAprovado: false }), ["morador", "proprietario"]);
  assert.deepEqual(papeisDaPilula({ ativo: "parceiro", temImovel: false, parceiroAprovado: false }), ["morador", "parceiro"]);
});

test("E900: com um papel só é selo (sem interruptor); com dois ou mais, interruptor com um segmento por papel", () => {
  const um = pilulaDoModo({ ativo: "morador", temImovel: false, parceiroAprovado: false });
  assert.equal(um.tipo, "selo");
  assert.deepEqual(um.segmentos, [{ papel: "morador", rotulo: "Morador", ativo: true }]);
  const dois = pilulaDoModo({ ativo: "proprietario", temImovel: true, parceiroAprovado: false });
  assert.equal(dois.tipo, "interruptor");
  assert.deepEqual(dois.segmentos, [
    { papel: "morador", rotulo: "Morador", ativo: false },
    { papel: "proprietario", rotulo: "Proprietário", ativo: true },
  ]);
  assert.equal(pilulaDoModo({ ativo: "parceiro", temImovel: true, parceiroAprovado: true }).segmentos.filter((s) => s.ativo).length, 1);
});

test("E900: a pílula está na casca em todas as larguras (cabeçalho no computador, linha do topo no celular) e fora do /admin", () => {
  const topo = ler("src/components/layout/topo-dono.tsx");
  assert.match(topo, /<PilulaDoModo[^>]*variante="topo"/, "no cabeçalho do computador");
  const casca = ler("src/components/layout/dashboard-shell.tsx");
  assert.match(casca, /\{pilula && \(\s*<div[^>]*data-testid="modo-linha"[^>]*>\s*<PilulaDoModo[^>]*variante="linha"/, "na linha do topo do celular");
  assert.match(casca, /const pilula = papelTopo \? pilulaDoModo\(/, "só fora do /admin (sem papel no topo, sem pílula)");
  assert.match(casca, /pilulaDoModo\(\{ ativo: papelTopo, temImovel, parceiroAprovado \}\)/, "os papéis vêm do contexto que a casca já tem na 1ª pintura");
});

test("E900: o componente tem ícone e palavra por modo, estado de cor por modo e o selo sem botão", () => {
  const c = ler("src/components/layout/pilula-do-modo.tsx");
  for (const papel of ["morador", "proprietario", "parceiro"]) assert.match(c, new RegExp(`${papel}: \\w+`), `ícone de ${papel}`);
  assert.match(c, /data-modo=\{/);
  assert.match(c, /aria-pressed=\{s\.ativo\}/);
  assert.match(c, /data-testid=\{`modo-selo-\$\{p\.variante\}`\}/);
  // A troca é a MESMA da Conta (usarPapel + painel do papel), nunca um segundo caminho.
  assert.match(c, /useTrocar\(\)/);
  const css = ler("src/app/globals.css");
  for (const papel of ["morador", "proprietario", "parceiro"]) assert.match(css, new RegExp(`\\.modo-pilula \\[data-modo="${papel}"\\]\\[data-ativo="1"\\]`), `cor de ${papel}`);
  // O rótulo "Conta" do E176 fica intocado.
  assert.match(ler("src/config/abas-painel.ts"), /rotulo: "Minha conta"/);
});
