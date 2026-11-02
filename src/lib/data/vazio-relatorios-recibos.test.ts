/*
  Estados vazios — relatórios de recibos (/api/recibos/resumo, /informe, /reembolso) e o bloco do celular:
  - leitura que falha nunca gera PDF com zero recibos (a rota pede `exigir` e responde 503);
  - falha ao ler quais contas são de teste nunca põe recibo de conta de teste no resumo de quem é real (lança);
  - o bloco do celular some na falha em vez de mostrar "R$ 0 recebido".
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const fn = (src: string, nome: string) => {
  const i = src.indexOf(nome);
  return src.slice(i, src.indexOf("\n}\n", i));
};

test("contasDeTeste lança no erro (nunca um conjunto vazio que deixaria a conta de teste passar)", () => {
  const f = fn(ler("./recibos.ts"), "async function contasDeTeste(");
  assert.match(f, /const \{ data, error \} = await admin/);
  assert.match(f, /if \(error\) throw new Error\(MSG_RECIBOS_NAO_CARREGARAM\);/);
});

test("recibosDaPessoa: sem `exigir`, falha → null (bloco some); com `exigir`, lança", () => {
  const f = fn(ler("./recibos.ts"), "export async function recibosDaPessoa(");
  assert.match(f, /if \(error && opcoes\.exigir\) throw new Error\(MSG_RECIBOS_NAO_CARREGARAM\);\s*\/\/[^\n]*\n\s*if \(error\) return null;/);
  assert.match(f, /contasDeTeste\(\[s\.userId, \.\.\.outros\]\)\.catch\(\(e\) => \{\s*if \(opcoes\.exigir\) throw e;\s*return null;\s*\}\);\s*if \(!teste\) return null;/);
});

test("rota dos relatórios: exige a leitura e responde 503 na falha", () => {
  const rota = ler("../../app/api/recibos/[relatorio]/route.ts");
  assert.ok(rota.includes('const d = await recibosDaPessoa(papel, { exigir: true }).catch(() => "falhou" as const);'));
  assert.ok(rota.includes('if (d === "falhou") return erro(503,'));
  assert.doesNotMatch(rota, /const d = await recibosDaPessoa\(papel\);/);
});
