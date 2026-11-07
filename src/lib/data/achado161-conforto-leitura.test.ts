/*
  Achado 161 — pendências do padrão mínimo: a falha de LEITURA da pendência virava "Pendência não encontrada." e a do contrato
  virava "Sem permissão." (e a lista da página, "nada"). Agora a falha tem frase própria e a página mostra o erro com
  "Tentar de novo". Roda: node --test src/lib/data/achado161-conforto-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./conforto-actions.ts", import.meta.url), "utf8");

test("papelNoContrato destrincha o erro e lança (não vira 'sem permissão')", () => {
  const fn = src.slice(src.indexOf("async function papelNoContrato("), src.indexOf("const MSG: Record<AcaoPendencia"));
  assert.match(fn, /const \{ data: c, error: erroContrato \}/);
  assert.match(fn, /if \(erroContrato\) throw new LeituraConfortoFalhou\(erroContrato\.message\);/);
});

test("agirNaPendencia: leitura da pendência e do papel com frase própria, antes de 'não encontrada' e 'sem permissão'", () => {
  const fn = src.slice(src.indexOf("export async function agirNaPendencia("), src.indexOf("const campos = transicaoPendencia("));
  assert.match(fn, /const \{ data: p, error: erroPendencia \} = await admin\.from\("conforto_pendencias"\)/);
  assert.match(fn, /if \(erroPendencia\) return \{ ok: false, erro: MSG_CONFORTO_SEM_LEITURA \};/);
  assert.ok(fn.indexOf("erroPendencia") < fn.indexOf("Pendência não encontrada."));
  assert.match(fn, /catch \(e\) \{\s*if \(e instanceof LeituraConfortoFalhou\) return \{ ok: false, erro: MSG_CONFORTO_SEM_LEITURA \};/);
  assert.match(src, /const MSG_CONFORTO_SEM_LEITURA = "Não foi possível ler esta pendência agora\. Tente de novo\."/);
});
