/*
  Erros/estados vazios (rodada 4) — pedir o código de assinatura: falha de LEITURA do contrato não vira "Contrato não encontrado.".
  Roda: node --test src/lib/data/e293-leitura-contrato-codigo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("pedirCodigoAssinaturaInterno separa erro de banco de 'Contrato não encontrado.'", () => {
  const s = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.match(
    s,
    /const \{ data, error: erroContrato \} = await admin\.from\("contratos"\)\.select\(COLUNAS\)\.eq\("id", contratoId\)\.maybeSingle\(\);\s*\n\s*if \(erroContrato\) return \{ ok: false, error: MSG_ASSINATURA_SEM_LEITURA \};/,
  );
});
