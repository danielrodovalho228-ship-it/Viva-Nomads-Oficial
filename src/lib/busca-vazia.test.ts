/*
  E695: a busca vazia não mente sobre a cidade. "A Viva ainda não chegou em X" só quando o lugar tem ZERO imóveis; havendo
  imóveis que a data/os filtros excluíram, a mensagem é de data/filtro, com a próxima disponibilidade quando conhecida.
  Roda: node --test src/lib/busca-vazia.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { proximaDisponibilidade, situacaoBuscaVazia } from "./busca-vazia.ts";

test("zero imóveis no lugar: é a cidade que ainda não chegou (convite de cidade)", () => {
  const s = situacaoBuscaVazia({ local: "Goiânia", imoveisNoLocal: [], hoje: "2026-11-07" });
  assert.equal(s.tipo, "cidade_sem_imoveis");
});

test("há imóveis no lugar mas nenhum disponível: mensagem de data/filtro, nunca 'não chegou'", () => {
  const s = situacaoBuscaVazia({ local: "Santa Mônica", imoveisNoLocal: [{ availableFrom: "2026-12-20" }, { availableFrom: "2027-01-05" }], hoje: "2026-11-07" });
  assert.equal(s.tipo, "sem_disponibilidade");
  if (s.tipo !== "sem_disponibilidade") return;
  assert.equal(s.quantos, 2);
  assert.equal(s.proxima, "2026-12-20");
  assert.match(s.titulo, /Há 2 imóveis em Santa Mônica/);
  assert.match(s.titulo, /data|filtros/);
  assert.doesNotMatch(s.titulo, /ainda não chegou/);
  assert.match(s.detalhe, /20\/12\/2026/);
});

test("um só imóvel usa o singular; sem data conhecida, não inventa próxima disponibilidade", () => {
  const s = situacaoBuscaVazia({ local: "Centro", imoveisNoLocal: [{ availableFrom: undefined }], hoje: "2026-11-07" });
  assert.equal(s.tipo, "sem_disponibilidade");
  if (s.tipo !== "sem_disponibilidade") return;
  assert.match(s.titulo, /Há 1 imóvel em Centro/);
  assert.equal(s.proxima, null);
  assert.doesNotMatch(s.detalhe, /disponível a partir de/);
});

test("proximaDisponibilidade ignora datas passadas e pega a menor futura (ou hoje)", () => {
  assert.equal(proximaDisponibilidade([{ availableFrom: "2026-01-01" }, { availableFrom: "2026-12-20" }, { availableFrom: "2026-11-30" }], "2026-11-07"), "2026-11-30");
  assert.equal(proximaDisponibilidade([{ availableFrom: "2026-11-07" }], "2026-11-07"), "2026-11-07");
  assert.equal(proximaDisponibilidade([{ availableFrom: "2026-01-01" }], "2026-11-07"), null);
  assert.equal(proximaDisponibilidade([], "2026-11-07"), null);
});

test("sem lugar digitado e sem resultado: mensagem genérica de filtros (nada de cidade)", () => {
  const s = situacaoBuscaVazia({ local: "", imoveisNoLocal: [{ availableFrom: "2026-12-01" }], hoje: "2026-11-07" });
  assert.equal(s.tipo, "sem_disponibilidade");
  if (s.tipo !== "sem_disponibilidade") return;
  assert.doesNotMatch(s.titulo, / em $| em undefined/);
});

test("a busca usa a situação: o convite de cidade só aparece quando o lugar tem zero imóveis", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.match(src, /situacaoBuscaVazia\(\{ local: locationQuery, imoveisNoLocal: baseVisivel/);
  const i = src.indexOf('situacaoVazia.tipo === "sem_disponibilidade" ?');
  assert.ok(i > 0);
  const trecho = src.slice(i, i + 1400);
  assert.ok(trecho.indexOf("busca-vazia-proxima") < trecho.indexOf("<ConviteCidade"), "o convite fica no ramo 'sem imóveis'");
});
