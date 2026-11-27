/*
  E816 — a disponibilidade não pode abrir simulando escolha feita. A entrada pré-preenchida vem da última busca
  guardada no aparelho (pode ser de dias atrás): a tela diz que veio de lá e deixa limpar; a frase "agora escolha a
  saída" fica só para a entrada escolhida nesta página.
  Roda: node --test src/lib/imovel/e816-entrada-da-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELECAO_VAZIA, clicarDia, comEntrada, comEntradaDaBusca, semDatas, textoDaSelecao } from "./selecao-estadia.ts";

test("entrada vinda da busca: o texto diz a origem, não 'agora escolha a saída'", () => {
  const s = comEntradaDaBusca(SELECAO_VAZIA, "2026-12-01");
  assert.equal(s.entradaDaBusca, true);
  const t = textoDaSelecao(s)!;
  assert.match(t, /^Entrada 01\/12\/2026, da sua última busca \(não escolhida aqui\)/);
  assert.doesNotMatch(t, /agora escolha a saída/);
});

test("escolha nesta página tira a marca da busca", () => {
  const s = comEntradaDaBusca(SELECAO_VAZIA, "2026-12-01");
  assert.ok(!clicarDia(s, "2026-12-05").entradaDaBusca, "clique no calendário");
  assert.ok(!comEntrada(s, "2026-12-03").entradaDaBusca, "campo de entrada");
  assert.equal(textoDaSelecao(comEntrada(s, "2026-12-03")), "Entrada 03/12/2026 — agora escolha a saída.");
});

test("limpar a data volta ao estado sem escolha (as pessoas ficam)", () => {
  const s = { ...comEntradaDaBusca(SELECAO_VAZIA, "2026-12-01"), pessoas: 2 };
  assert.deepEqual(semDatas(s), { entrada: "", saida: "", pessoas: 2 });
  assert.equal(textoDaSelecao(semDatas(s)), null);
});

test("a página marca a entrada da busca e o calendário usa o texto e o botão de limpar", () => {
  const pagina = readFileSync(new URL("../../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(pagina, /comEntradaDaBusca\(atual, daBusca\.entrada\)/);
  const cal = readFileSync(new URL("../../components/property/availability-calendar.tsx", import.meta.url), "utf8");
  assert.match(cal, /\{textoDaSelecao\(selecao\)\}/);
  assert.doesNotMatch(cal, /<>Entrada \{brDate\(checkIn\)\} — agora escolha a saída\.<\/>/);
  assert.match(cal, /data-testid="calendario-limpar-data-busca"/);
});
