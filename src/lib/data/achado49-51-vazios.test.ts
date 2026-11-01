/*
  Varredura de erros e estados vazios (rodada 5) — falha de leitura nunca vira "vazio" numa tela que leva a agir.
  Achado 49: interessadosParaProposta → "Nenhum interessado" e sem a marca de proposta em andamento (dava para duplicar).
  Achado 50: listarImportacoes → links do calendário sumiam e o limite de 3 deixava de contar.
  Achado 51: meusPets → ficha vazia (o morador recadastraria os pets).
  Roda: node --test src/lib/data/achado49-51-vazios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const trecho = (s: string, de: string, ate: string) => s.slice(s.indexOf(de), s.indexOf(ate, s.indexOf(de) + de.length));

test("achado 49: as duas leituras dos interessados lançam na falha (a página cai no aviso de erro)", () => {
  const fn = trecho(ler("src/lib/data/propostas-actions.ts"), "export async function interessadosParaProposta", "export interface DadosMontagem");
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler os interessados agora\."\);/);
  assert.match(fn, /if \(eAbertas\) throw new Error\("Não foi possível ler as propostas em andamento agora\."\);/);
});

test("achado 50: importações do calendário — o servidor lança e a tela avisa com Tentar de novo", () => {
  const fn = trecho(ler("src/lib/data/calendario-importacao-actions.ts"), "export async function listarImportacoes", "/** Cola o link");
  assert.match(fn, /if \(error\) throw new Error/);
  const tela = ler("src/components/property/importar-calendario.tsx");
  assert.doesNotMatch(tela, /\.catch\(\(\) => vivo && setLista\(\[\]\)\)/);
  assert.match(tela, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(tela, /data-testid="importacoes-falha"/);
  assert.match(tela, /data-testid="importacoes-tentar"/);
});

test("achado 51: pets — o servidor lança e a ficha avisa com Tentar de novo (nunca vazia)", () => {
  const fn = trecho(ler("src/lib/data/pets-ficha-actions.ts"), "export async function meusPets", "export async function salvarPet");
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler seus pets agora\."\);/);
  const ficha = ler("src/components/account/pets-ficha.tsx");
  assert.match(ficha, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(ficha, /data-testid="pets-falha"/);
  assert.match(ficha, /\}, \[tentativa\]\);/);
});
