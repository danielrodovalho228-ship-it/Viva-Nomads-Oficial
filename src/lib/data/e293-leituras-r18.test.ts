/*
  Varredura de erros (rodada 18): falha ao conferir o dono do imóvel nas provas por foto/medição não vira "Sem permissão."
  O dono via "Sem permissão" num imóvel que é dele quando a leitura falhava; agora vê que não foi possível conferir agora.
  Roda: node --test src/lib/data/e293-leituras-r18.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("./prova-actions.ts", import.meta.url), "utf8");

test("as duas conferências de dono distinguem falha de leitura de 'não é o dono'", () => {
  assert.equal((s.match(/const \{ data, error \} = await supabase\.from\("properties"\)\.select\("owner_id"\)/g) ?? []).length, 2);
  assert.equal((s.match(/if \(error\) return FALHA_LEITURA;/g) ?? []).length, 2);
});

test("as ações que pedem token ou link mostram o erro de leitura, não 'Sem permissão.'", () => {
  assert.equal((s.match(/if \(c === FALHA_LEITURA\) return \{ ok: false, erro: ERRO_LEITURA \};/g) ?? []).length, 3);
  for (const m of s.matchAll(/if \(c === FALHA_LEITURA\)[^\n]*\n([^\n]*)/g)) assert.match(m[1], /Sem permissão\./);
});
