/*
  E539 (ii) — duas buscas salvas idênticas "Todas as cidades" no painel do morador. Produção (05/11): a inquilino2@
  tem "ordem=recent" e "" — a mesma busca (sem filtro), só a ordenação diferente; o "já está salva?" comparava o texto
  inteiro dos parâmetros. Agora a IDENTIDADE da busca são os filtros (sem a ordenação): salvar a mesma de novo desfaz em
  vez de duplicar, a lista mostra uma só (a mais recente) e apagar leva junto as repetidas.
  Roda: node --test src/lib/busca/e539-buscas-repetidas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveDaBusca, normalizarBusca, semBuscasRepetidas } from "./buscas-salvas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("a identidade ignora a ordenação (e a ordem dos parâmetros); os filtros contam", () => {
  assert.equal(chaveDaBusca("ordem=recent"), chaveDaBusca(""));
  assert.equal(chaveDaBusca("?local=Uberl%C3%A2ndia&ordem=preco"), chaveDaBusca("local=Uberl%C3%A2ndia"));
  assert.notEqual(chaveDaBusca("local=Uberl%C3%A2ndia"), chaveDaBusca(""));
  assert.match(normalizarBusca("ordem=recent"), /ordem=recent/, "a ordenação continua guardada (abrir a busca a restaura)");
});

test("a lista mostra uma por identidade (a primeira = a mais recente)", () => {
  const lista = [
    { id: "b", parametros: "" },
    { id: "a", parametros: "ordem=recent" },
    { id: "c", parametros: "local=Uberl%C3%A2ndia" },
  ];
  assert.deepEqual(semBuscasRepetidas(lista).map((b) => b.id), ["b", "c"]);
});

test("servidor: 'já salva', salvar/desfazer, listar e apagar usam a identidade", () => {
  const a = ler("lib/data/buscas-salvas-actions.ts");
  assert.match(a, /chaveDaBusca\(b\.parametros\) === chave/);
  assert.equal((a.match(/await mesmasBuscas\(s, /g) ?? []).length, 3);
  assert.match(a, /return semBuscasRepetidas\(/);
  assert.match(a, /\.delete\(\)\.in\("id", iguais\)\.eq\("usuario_id", s\.user\.id\)/);
  assert.doesNotMatch(a, /\.eq\("parametros", parametros\)/);
});
