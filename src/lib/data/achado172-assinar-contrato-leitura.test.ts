/*
  Achado 172 — assinar o contrato: a leitura do contrato não olhava o erro; com o banco falhando quem ia assinar lia
  "Contrato não encontrado." e achava que o contrato tinha sumido.
  Roda: node --test src/lib/data/achado172-assinar-contrato-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./contrato-assinar-actions.ts", import.meta.url), "utf8");

test("assinar: destrincha o erro antes de 'Contrato não encontrado'", () => {
  assert.match(src, /const \{ data, error: erroContrato \} = await admin\.from\("contratos"\)\.select\(COLUNAS\)\.eq\("id", contratoId\)\.maybeSingle\(\);\n\s*if \(erroContrato\) return \{ ok: false, error: "Não foi possível ler o contrato agora\. Tente de novo\." \};/);
});
