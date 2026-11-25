/*
  Varredura de erros e estados vazios (rodada 12) — o contrato nunca nasce com valor de outra fonte porque uma leitura
  falhou.
  Achado 72: taxaDoLeadDoDono engolia o erro → "sem taxa congelada" → o contrato e a comissão saíam com a taxa padrão.
  Achado 73: propostaAcordadaDoLead engolia o erro → "sem proposta" → o contrato saía com o preço do ANÚNCIO, não o acordado.
  Roda: node --test src/lib/data/achado72-73-valores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 72: taxaDoLeadDoDono lança na falha; registrar e carregar o fechamento recusam com aviso", () => {
  const s = ler("src/lib/data/taxa-dono-servidor.ts");
  const fn = s.slice(s.indexOf("export async function taxaDoLeadDoDono"));
  assert.match(fn, /const \{ data, error \} = await admin\.from\("leads"\)/);
  assert.match(fn, /if \(error\) throw new Error\(MSG_VALORES_SEM_CONFERIR\);/);
  assert.match(s, /MSG_VALORES_SEM_CONFERIR = "Não foi possível conferir os valores acordados agora\. Tente de novo em instantes\."/);
  assert.match(ler("src/lib/data/actions.ts"), /taxaDoLeadDoDono\(admin, user\.id, lead\.id as string\)\.catch\(\(\) => "falhou" as const\);\s*if \(taxaLead === "falhou"\) return \{ ok: false, error: MSG_VALORES_SEM_CONFERIR \};/);
  assert.match(ler("src/lib/data/fechamento-servidor.ts"), /taxaDoLeadDoDono\(admin, user\.id, lead\.id as string\)\.catch\(\(\) => "falhou" as const\);\s*if \(taxaLead === "falhou"\) return \{ status: 503, error: MSG_VALORES_SEM_CONFERIR \};/);
});

test("achado 73: propostaAcordadaDoLead lança na falha das duas leituras; ninguém cai no preço do anúncio", () => {
  const s = ler("src/lib/data/propostas-servidor.ts");
  const fn = s.slice(s.indexOf("export async function propostaAcordadaDoLead"));
  assert.match(fn, /if \(erroProposta\) throw new Error\(MSG_VALORES_SEM_CONFERIR\);\s*if \(!p\) return null;/);
  assert.match(fn, /if \(erroVersao\) throw new Error\(MSG_VALORES_SEM_CONFERIR\);\s*if \(!v\) return null;/);
  assert.match(ler("src/lib/data/actions.ts"), /propostaAcordadaDoLead\(admin, lead\.id as string\)\.catch\(\(\) => "falhou" as const\);\s*if \(acordada === "falhou"\) return \{ ok: false, error: MSG_VALORES_SEM_CONFERIR \};/);
  assert.match(ler("src/lib/data/fechamento-servidor.ts"), /propostaAcordadaDoLead\(admin, lead\.id as string\)\.catch\(\(\) => "falhou" as const\);\s*if \(acordada === "falhou"\) return \{ status: 503, error: MSG_VALORES_SEM_CONFERIR \};/);
});
