/*
  Varredura de erros e estados vazios (rodada 21) — leitura que falha nunca vira "vazio" que engana quem decide.
  Achado 99: parceirosDoImovel → "nenhum parceiro fixo": o dono convidava de novo quem já estava ligado.
  Achado 100: meusImoveisFixos → "Nenhum imóvel fixo": o parceiro não via convites a responder nem vínculos ativos.
  Achado 101: conferência de entrada → todo contrato "Não aberta" (lista da pessoa e coluna do admin).
  Roda: node --test src/lib/data/achado99-101.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fn = (s: string, de: string) => {
  const i = s.indexOf(de);
  const j = s.indexOf("\nexport ", i + 1);
  return s.slice(i, j < 0 ? undefined : j);
};

test("achado 99: parceiros do imóvel lançam na falha (error.tsx), nunca 'nenhum parceiro'", () => {
  assert.match(fn(ler("src/lib/automacao/acoes.ts"), "export async function parceirosDoImovel"), /if \(error\) throw new Error\("Não foi possível ler os parceiros do imóvel\."\);/);
});

test("achado 100: imóveis fixos lançam; o bloco avisa e o resto do painel do parceiro segue", () => {
  const f = fn(ler("src/lib/automacao/acoes.ts"), "export async function meusImoveisFixos");
  assert.match(f, /if \(e1\) throw new Error\(MSG_FIXOS_SEM_LEITURA\);/);
  assert.match(f, /if \(e2\) throw new Error\(MSG_FIXOS_SEM_LEITURA\);/);
  const t = ler("src/components/automacao/imoveis-fixos.tsx");
  assert.match(t, /meusImoveisFixos\(\)\.catch\(\(\) => null\)/);
  assert.match(t, /lista === null \?[\s\S]{0,200}data-testid="imoveis-fixos-falhou"/);
});

test("achado 101: estados da conferência de entrada lançam (lista da pessoa e coluna do admin)", () => {
  for (const p of ["src/lib/data/conferencia-lista.ts", "src/lib/data/contrato-admin.ts"]) {
    assert.match(ler(p), /if \(error\) throw new Error\("Não foi possível ler as conferências de entrada\."\);/, p);
  }
});
