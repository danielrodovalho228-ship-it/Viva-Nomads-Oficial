/*
  Achado nº 24 — o Início do painel avisa quando uma leitura falha (nunca "0 decisões" ou contador 0 sem aviso).
  Roda: node --test src/lib/painel/sem-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoInicioSemLeitura, valorContador } from "./sem-leitura.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o aviso diz o que não foi lido; sem falha, não há aviso", () => {
  assert.equal(avisoInicioSemLeitura([]), null);
  assert.equal(
    avisoInicioSemLeitura(["propostas", "estadias"]),
    "Não foi possível ler agora: propostas e estadias. As decisões e os números abaixo podem estar incompletos — recarregue a página em instantes.",
  );
  assert.match(avisoInicioSemLeitura(["conversas", "buscas", "candidaturas"])!, /ler agora: mensagens, buscas salvas e candidaturas\./);
  assert.match(avisoInicioSemLeitura(["propostas", "propostas"])!, /ler agora: propostas\./);
});

test("contador sem leitura é '—', nunca '0'", () => {
  assert.equal(valorContador(null), "—");
  assert.equal(valorContador(undefined), "—");
  assert.equal(valorContador(0), "0");
  assert.equal(valorContador(3), "3");
});

test("o Início lê cada lista com exigir, registra a falha e mostra o aviso no topo", () => {
  const pg = ler("src/app/(dashboard)/dashboard/page.tsx");
  for (const [fonte, chamada] of [
    ["propostas", "listarPropostas\\(\\{ exigir: true \\}\\)"],
    ["estadias", "estadiasDaHome\\(agora, \\{ exigir: true \\}\\)"],
    ["candidaturas", "listMinhasCandidaturas\\(\\{ exigir: true \\}\\)"],
    ["conversas", "listConversations\\(\\{ exigir: true \\}\\)"],
    ["buscas", "listarBuscasSalvas\\(\\{ exigir: true \\}\\)"],
  ]) {
    assert.match(pg, new RegExp(`ou\\("${fonte}", ${chamada}`), fonte);
  }
  assert.doesNotMatch(pg, /listarPropostas\(\)\.catch\(\(\) => \[\]\)|listConversations\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pg, /data-testid="inicio-sem-leitura"/);
  const vg = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.doesNotMatch(vg, /String\(totalConversas\)|String\(totalCandidaturas\)|String\(totalBuscasSalvas\)/);
  assert.match(ler("src/lib/data/estadia.ts"), /if \(error && opcoes\.exigir\) throw new Error\("Não foi possível ler as suas estadias agora\."\)/);
});
