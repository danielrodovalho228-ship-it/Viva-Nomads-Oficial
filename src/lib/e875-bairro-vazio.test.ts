/*
  E875 (RELATORIO-021, A-112) — na grade de bairros da cidade, "Martins — Sem imóveis no momento" aparecia sem caminho.
  Agora o cartão diz o caminho; a página do bairro vazio já tem o aviso e os vizinhos com imóveis.
  Roda: node --test src/lib/e875-bairro-vazio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bairrosDaGrade, textoBairroNaGrade } from "./bairros.ts";
import { SAMPLE_PROPERTIES } from "./properties.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("bairro sem imóvel: diz que está vazio E o caminho; com imóvel, só a contagem", () => {
  assert.deepEqual(textoBairroNaGrade(0), { linha: "Sem imóveis no momento", dica: "Avise-me quando houver e veja os bairros vizinhos" });
  assert.deepEqual(textoBairroNaGrade(1), { linha: "1 imóvel", dica: null });
  assert.deepEqual(textoBairroNaGrade(2), { linha: "2 imóveis", dica: null });
});

test("Uberlândia: o Martins (curado, sem imóvel) está na grade, por último, e leva o caminho", () => {
  const grade = bairrosDaGrade("uberlandia", SAMPLE_PROPERTIES, () => false);
  const martins = grade.find((b) => b.slug === "martins");
  assert.ok(martins, "Martins na grade");
  assert.equal(martins!.total, 0);
  assert.equal(grade[grade.length - 1].total, 0, "os vazios vão para o fim");
  assert.ok(textoBairroNaGrade(martins!.total).dica);
});

test("a grade usa o texto único, e a página do bairro vazio entrega o caminho prometido", () => {
  const cidade = ler("app/(public)/cidades/[cidade]/page.tsx");
  assert.match(cidade, /textoBairroNaGrade\(b\.total\)\.linha/);
  assert.match(cidade, /data-testid="bairro-cartao-dica"/);
  assert.doesNotMatch(cidade, /b\.total === 0 \? "Sem imóveis no momento"/);
  const pagina = ler("components/cidades/bairro-pagina.tsx");
  assert.match(pagina, /rotulo="Avise-me quando houver"/);
  assert.match(pagina, /data-testid="bairro-vizinhos"/);
});
