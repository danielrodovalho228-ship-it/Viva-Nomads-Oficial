import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: o aceite da proposta nunca congela a taxa de hoje no lugar da do envio por leitura
 * falha, e a contraproposta do morador nunca passa por cima do limite privado do dono por leitura falha.
 */
const ler = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const servidor = ler("./propostas-servidor.ts");
const acoes = ler("./propostas-actions.ts");
function trecho(fonte: string, inicio: string): string {
  const i = fonte.indexOf(inicio);
  assert.ok(i >= 0, inicio);
  return fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);
}

test("lerTaxaDaProposta lança na falha de leitura (não devolve taxa_no_envio null)", () => {
  const f = trecho(servidor, "export async function lerTaxaDaProposta(");
  assert.match(f, /const \{ data, error \} = await admin\.from\("propostas"\)\.select\(COLUNAS_TAXA_PROPOSTA\)/);
  assert.match(f, /if \(error\) throw new Error\(MSG_VALORES_SEM_CONFERIR\);/);
});

test("aceitar: sem a taxa do envio não aceita, antes de gravar o aceite", () => {
  const f = trecho(acoes, "async function aceitar(");
  const guarda = f.search(/const tx = await lerTaxaDaProposta\(admin, p\.id\)\.catch\(\(\) => null\);\s*if \(!tx\) return \{ ok: false, error: MSG_TAXA_SEM_LEITURA \};/);
  assert.ok(guarda >= 0, "guarda da taxa do envio");
  assert.ok(guarda < f.indexOf('status: "aceita"'), "antes do update do aceite");
});

test("lerProposta: taxa ilegível não aparece (nunca a de hoje no lugar da do envio)", () => {
  assert.match(acoes, /const tx = await lerTaxaDaProposta\(s\.admin, p\.id\)\.catch\(\(\) => null\);/);
  assert.match(acoes, /const pct = !tx \? null : congelada/);
  assert.match(acoes, /if \(tx && pct != null\) taxa = \{/);
});

test("contraproposta do morador: limite do dono ilegível para antes de gravar a versão", () => {
  const f = trecho(acoes, "export async function responderProposta(");
  const guarda = f.indexOf("if (erroLim) return");
  assert.ok(guarda >= 0, "guarda do limite");
  assert.ok(guarda < f.indexOf('from("proposta_versoes").insert('), "antes do insert da versão");
});
