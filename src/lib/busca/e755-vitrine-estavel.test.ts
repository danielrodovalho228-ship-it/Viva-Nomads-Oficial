/*
  E755 — a vitrine é estável entre carregamentos da mesma busca (mesma ordem, mesmo conteúdo).
  Roda: node --test src/lib/busca/e755-vitrine-estavel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { desempatePorId } from "./ordem-estavel.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";

test("empate desempata pelo id: qualquer ordem de entrada dá a mesma saída", () => {
  const base = [...SAMPLE_PROPERTIES].map((p) => ({ id: p.id, k: 1 }));
  const esperado = [...base].sort((a, b) => b.k - a.k || desempatePorId(a, b)).map((p) => p.id);
  for (let i = 0; i < 25; i++) {
    const embaralhado = [...base].sort(() => Math.random() - 0.5);
    assert.deepEqual(embaralhado.sort((a, b) => b.k - a.k || desempatePorId(a, b)).map((p) => p.id), esperado);
  }
});

test("o catálogo de exemplo é fixo: 15 anúncios, ids únicos, sem sorteio nem data de execução no título/preço", () => {
  assert.equal(SAMPLE_PROPERTIES.length, 15);
  assert.equal(new Set(SAMPLE_PROPERTIES.map((p) => p.id)).size, 15);
  const a = JSON.stringify(SAMPLE_PROPERTIES.map((p) => [p.id, p.title, p.monthlyPrice]));
  const b = JSON.stringify(SAMPLE_PROPERTIES.map((p) => [p.id, p.title, p.monthlyPrice]));
  assert.equal(a, b);
});

test("as consultas da vitrine ordenam por created_at E por id (lotes com o mesmo created_at não trocam de lugar)", () => {
  const src = readFileSync("src/lib/data/properties.ts", "utf8");
  const consultas = src.match(/\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: true \}\)/g) ?? [];
  assert.ok(consultas.length >= 3, "listProperties, página do dono e a lista do painel");
  assert.doesNotMatch(src, /\.order\("created_at", \{ ascending: false \}\)\s*[,;)]/, "nenhuma consulta fica só com created_at");
});

test("toda ordenação da busca no cliente tem desempate por id e não usa sorteio", () => {
  const src = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  assert.ok((src.match(/desempatePorId/g) ?? []).length >= 6);
  assert.doesNotMatch(src, /Math\.random/);
  const page = readFileSync("src/app/(public)/buscar/page.tsx", "utf8");
  assert.doesNotMatch(page, /Math\.random|shuffle/);
});
