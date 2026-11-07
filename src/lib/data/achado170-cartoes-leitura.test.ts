/*
  Achado 170 — cartão do anúncio (dono) e cartão-postal (morador): a leitura do imóvel/contrato não olhava o erro;
  com o banco falhando a pessoa lia "Imóvel não encontrado." / "Contrato não encontrado.".
  Roda: node --test src/lib/data/achado170-cartoes-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./cartoes-actions.ts", import.meta.url), "utf8");

test("cartão do anúncio: destrincha o erro antes de 'Imóvel não encontrado'", () => {
  assert.match(src, /const \{ data: p, error: erroImovel \} = await s\.admin\.from\("properties"\)/);
  assert.match(src, /if \(erroImovel\) return \{ ok: false, error: "Não foi possível ler o imóvel agora\. Tente de novo\." \};\n\s*if \(!p \|\| p\.owner_id !== s\.user\.id\) return \{ ok: false, error: "Imóvel não encontrado\." \};/);
});

test("cartão-postal: destrincha o erro antes de 'Contrato não encontrado'", () => {
  assert.match(src, /const \{ data: c, error: erroContrato \} = await s\.admin\s*\.from\("contratos"\)/);
  assert.match(src, /if \(erroContrato\) return \{ ok: false, error: "Não foi possível ler o contrato agora\. Tente de novo\." \};\n\s*if \(!c \|\| c\.tenant_id !== s\.user\.id\) return \{ ok: false, error: "Contrato não encontrado\." \};/);
});
