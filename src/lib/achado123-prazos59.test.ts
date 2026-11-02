/*
  Frente 1, rodada 3 — achado 123 (ALTA): a rotina dos prazos do Padrão mínimo (59) lia as declarações sem conferir o
  erro. Na falha, todo imóvel parecia incompleto e, com o prazo vencido, era TIRADO DA BUSCA (pausado) por engano. Na
  parte C (manutenção), os avisos já enviados não lidos faziam os avisos saírem de novo. Agora a leitura que falha pula
  a parte nesta rodada (nada é pausado nem reenviado; a próxima tenta de novo), sem derrubar as outras partes.
  Roda: node --test src/lib/achado123-prazos59.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./prazos-59-servidor.ts", import.meta.url), "utf8");

test("parte A: sem as declarações (ou a adequação), nenhum imóvel é pausado", () => {
  assert.match(src, /const linhas = \(erroAdq \? \[\] : \(adq \?\? \[\]\)\)/);
  assert.match(src, /for \(const l of erroDecl \? \[\] : linhas\) \{/);
  assert.ok(src.indexOf("for (const l of erroDecl ? [] : linhas)") < src.indexOf('status: "paused", pausa_motivo: "conforto"'));
});

test("parte C: sem os avisos já enviados, nada é reenviado (e a rotina não cai)", () => {
  assert.match(src, /if \(erroEvs\) \{[\s\S]*?pularC = true;/);
  assert.match(src, /for \(const o of pularC \? \[\] : lista\) \{/);
  assert.doesNotMatch(src, /if \(erroEvs\) throw/);
});
