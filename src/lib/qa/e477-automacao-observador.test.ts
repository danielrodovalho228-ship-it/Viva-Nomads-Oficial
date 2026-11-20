/*
  E477 (resíduo — "Rodar a automação de hoje"). A auditoria das telas do admin não pegou uma escrita real: em
  /admin/parceiros/pedidos o botão "Rodar a automação de hoje" chama rodarAutomacaoAgora (src/lib/automacao/acoes.ts),
  que só checava ehAdmin. O observador da QA (qa_admin) é admin com 2FA próprio, então passava — e, com AUTOMACOES_ATIVO=1
  em produção, o passo diário da estadia grava DE VERDADE (pedidos automáticos, sugestões e avisos de 24 h a moradores reais).
  Correção: o servidor recusa o observador antes da primeira escrita (sem alvo: ação proibida sempre) e a tela mostra
  "Só leitura" no lugar do botão. Esta correção NÃO altera a chave AUTOMACOES_ATIVO.
  Roda: node --test src/lib/qa/e477-automacao-observador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ESCRITA = /automacaoDaEstadia\(|\.(insert|update|upsert|delete)\(|logModeracao\(|revalidatePath\(/;

test("rodarAutomacaoAgora recusa a conta observadora antes de qualquer escrita", () => {
  const src = ler("src/lib/automacao/acoes.ts");
  assert.match(src, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/);
  const i = src.search(/export async function rodarAutomacaoAgora\b/);
  assert.ok(i >= 0);
  const c = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(c, /recusaObservador\(user\.id\)/, "sem alvo: ação proibida sempre ao observador");
  assert.match(c, /if \(recusaQa\) return \{ ok: false, erro: recusaQa \};/);
  const g = c.indexOf("recusaObservador(");
  const e = c.search(ESCRITA);
  assert.ok(g > -1 && e > -1 && g < e, "a guarda vem antes da primeira escrita");
  assert.ok(c.indexOf("ehAdmin(") < g, "o papel de admin continua sendo checado primeiro");
});

test("a tela de pedidos mostra 'Só leitura' no lugar do botão para o observador", () => {
  const p = ler("src/app/(dashboard)/admin/parceiros/pedidos/page.tsx");
  assert.match(p, /import \{ soLeituraNaTela \} from "@\/lib\/qa\/observador";/);
  assert.match(p, /import \{ SoLeituraQa \} from "@\/components\/admin\/so-leitura-qa";/);
  assert.match(p, /const soLeitura = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/);
  assert.match(p, /soLeitura \? <SoLeituraQa \/> : <RodarAutomacao \/>/);
});

test("a chave AUTOMACOES_ATIVO não é tocada: o texto da ação segue lendo a chave como antes", () => {
  const src = ler("src/lib/automacao/acoes.ts");
  // Só o código: comentários podem citar a chave (ex.: "AUTOMACOES_ATIVO=1") sem que isso seja atribuição.
  const codigo = src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
  assert.match(codigo, /process\.env\.AUTOMACOES_ATIVO === "1"/);
  assert.doesNotMatch(codigo, /AUTOMACOES_ATIVO\s*=(?!=)/, "só leitura da chave, nunca atribuição");
});
