/*
  Achado 174 — estadia: abrir uma proposta de aditivo e salvar as instruções de chegada de um contrato liam sem olhar o
  erro; com o banco falhando a pessoa lia "Proposta não encontrada." / "Contrato não encontrado.".
  Roda: node --test src/lib/data/achado174-estadia-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./estadia-actions.ts", import.meta.url), "utf8");

test("aditivo: destrincha o erro antes de 'Proposta não encontrada'", () => {
  assert.match(src, /const \{ data, error: erroAditivo \} = await admin\.from\("contrato_aditivos"\)/);
  assert.match(src, /if \(erroAditivo\) return \{ erro: "Não foi possível ler a proposta agora\. Tente de novo\." \};\n\s*const a = data as LinhaAditivo \| null;/);
});

test("instruções de chegada: destrincha o erro antes de 'Contrato não encontrado'", () => {
  assert.match(src, /const \{ data: k, error: erroContrato \} = await admin\.from\("contratos"\)\.select\("id"\)\.eq\("id", contratoId\)\.eq\("property_id", propertyId\)\.maybeSingle\(\);\n\s*if \(erroContrato\) return \{ ok: false, erro: "Não foi possível ler o contrato agora\. Tente de novo\." \};/);
});
