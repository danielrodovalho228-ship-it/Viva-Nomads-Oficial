/*
  E532 (parte 2) — "Voltar à busca" do /comparar descartava a ordenação e os filtros (voltava para /buscar limpo).
  Agora o "Comparar (N)" leva a busca de agora em ?volta=…, e o /comparar devolve a ela (só /buscar, nunca outro
  caminho; a consulta é relida pelo URLSearchParams). "Tirar da comparação" mantém a volta.
  Roda: node --test src/lib/busca/e532-voltar-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consultaDaBusca, hrefComparar, hrefVoltarBusca } from "./comparar.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const A = "ube-001";
const B = "ube-002";

test("o Comparar leva a busca (filtros e ordenação) e o Voltar devolve a ela", () => {
  const href = hrefComparar([A, B], "?cidade=Uberl%C3%A2ndia&ordem=preco&max=4000");
  assert.equal(href, `/comparar?comparar=${A},${B}&volta=${encodeURIComponent("cidade=Uberl%C3%A2ndia&ordem=preco&max=4000")}`);
  const volta = new URL(`https://x${href}`).searchParams.get("volta");
  assert.equal(hrefVoltarBusca(volta), "/buscar?cidade=Uberl%C3%A2ndia&ordem=preco&max=4000");
});

test("sem busca, o de antes; consulta suja não vira outro caminho", () => {
  assert.equal(hrefComparar([A, B]), `/comparar?comparar=${A},${B}`);
  assert.equal(hrefComparar([A, B], ""), `/comparar?comparar=${A},${B}`);
  assert.equal(hrefVoltarBusca(null), "/buscar");
  assert.equal(hrefVoltarBusca("//evil.com/x"), "/buscar?%2F%2Fevil.com%2Fx=");
  assert.ok(hrefVoltarBusca("a=1&comparar=x&volta=y") === "/buscar?a=1");
  assert.equal(consultaDaBusca("x".repeat(2001)), "");
});

test("a tela: o Comparar lê a busca no clique; o /comparar usa a volta nos dois 'Voltar' e no 'Tirar'", () => {
  const barra = ler("components/busca/barra-comparar.tsx");
  assert.match(barra, /router\.push\(hrefComparar\(ids, window\.location\.search\)\)/);
  const pg = ler("app/(public)/comparar/page.tsx");
  assert.equal((pg.match(/href=\{voltarBusca\}/g) ?? []).length, 2);
  assert.match(pg, /hrefComparar\(ids\.filter\(\(x\) => x !== p\.id\), volta\)/);
});
