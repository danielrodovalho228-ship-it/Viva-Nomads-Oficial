/*
  Auditoria de erros e estados vazios — achado nº 45: no painel de desempenho do anúncio, a falha na leitura do imóvel
  virava "não encontrado" e a dos eventos virava zero visualizações — o dono acharia que ninguém viu o anúncio.
  Agora painelDesempenho LANÇA e o painel mostra o aviso com "Tentar de novo" (dashboard/error.tsx).
  Roda: node --test src/lib/data/achado45-desempenho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("achado 45: painelDesempenho lança quando o imóvel ou os números não carregam", () => {
  const src = ler("./desempenho-anuncio.ts");
  const fn = src.slice(src.indexOf("export async function painelDesempenho"));
  const lancaImovel = fn.indexOf("if (erroImovel) throw new Error");
  assert.ok(lancaImovel > 0 && lancaImovel < fn.indexOf("if (!alvo || alvo.owner_id !== user.id) return null;"), "o erro sobe antes do 'não encontrado'");
  assert.match(fn, /const falha = \[lEvs, lPublicacoes, lMedicoes, lNivel\]\.find\(\(r\) => r\.error\);\n\s*if \(falha\) throw new Error/);
  assert.ok(fn.indexOf("if (falha) throw") < fn.indexOf("const eventos ="), "antes de contar as visualizações");
  assert.match(ler("../../app/(dashboard)/dashboard/error.tsx"), /Tentar de novo/);
});
