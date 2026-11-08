/*
  Erros/estados vazios (rodada 10) — propostas: falha de LEITURA não vira "Proposta não encontrada", 404 nem
  "candidatura não está mais em andamento". Roda: node --test src/lib/data/e293-leituras-propostas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/propostas-actions.ts", import.meta.url), "utf8");

test("mensagem própria de falha de leitura da proposta", () => {
  assert.match(s, /const MSG_PROPOSTA_SEM_LEITURA = "[^"]+";/);
});

test("lerProposta lança em falha de leitura (error.tsx), em vez de devolver null (404)", () => {
  assert.match(s, /const \{ data: pRow, error: erroProposta \} = await s\.supabase\.from\("propostas"\)/);
  assert.match(s, /if \(erroProposta\) throw new Error\(MSG_PROPOSTA_SEM_LEITURA\);/);
  assert.match(s, /const \{ data: vs, error: erroVersoes \} = await/);
  assert.match(s, /if \(erroVersoes\) throw new Error\(MSG_PROPOSTA_SEM_LEITURA\);/);
});

test("carregarParaResponder separa erro de 'não existe' e responderProposta devolve a mensagem de leitura antes de 'não encontrada'", () => {
  assert.match(s, /if \(erroProposta\) return "erro" as const;/);
  assert.match(s, /if \(erroVersao\) return "erro" as const;/);
  const i = s.indexOf('if (c === "erro") return { ok: false, error: MSG_PROPOSTA_SEM_LEITURA };');
  assert.ok(i > 0 && i < s.indexOf('"Proposta não encontrada."'));
});

test("aceitar não trata falha na leitura da candidatura como 'não está mais em andamento'", () => {
  assert.match(s, /const \{ data: lead, error: erroLead \} = await admin\.from\("leads"\)\.select\("id, status"\)/);
  assert.ok(s.indexOf("if (erroLead)") < s.indexOf("não está mais em andamento"));
});
