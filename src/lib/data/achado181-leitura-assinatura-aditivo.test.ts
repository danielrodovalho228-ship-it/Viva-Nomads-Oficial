import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 181 (varredura "leitura que falha não vira outra resposta", mesma família do E675): na assinatura do aditivo,
 * a leitura do código virava "Peça o código por e-mail…" e a leitura de "já assinou" deixava pedir outro código.
 */
const fonte = readFileSync(new URL("./estadia-actions.ts", import.meta.url), "utf8");
const pedir = fonte.slice(fonte.indexOf("export async function pedirCodigoAditivo("), fonte.indexOf("export async function assinarAditivo("));
const assinar = fonte.slice(fonte.indexOf("export async function assinarAditivo("));

test("assinarAditivo: leitura do código com erro para antes de conferir (não vira 'peça o código')", () => {
  assert.match(assinar, /const \{ data: linha, error: erroLinha \} = await ctx\.admin\.from\("contrato_aditivo_codigos"\)/);
  const g = assinar.indexOf("if (erroLinha)");
  assert.ok(g >= 0);
  assert.match(assinar.slice(g, g + 140), /Não foi possível conferir o código agora/);
  assert.ok(g < assinar.indexOf("conferirCodigo(lc,"));
});

test("pedirCodigoAditivo: leitura de 'já assinou' com erro não segue para mandar outro código", () => {
  assert.match(pedir, /const \{ data: ja, error: erroJa \} = await ctx\.admin\.from\("contrato_aditivo_assinaturas"\)/);
  const g = pedir.indexOf("if (erroJa)");
  assert.ok(g >= 0);
  assert.ok(g < pedir.indexOf('"Você já assinou este aditivo."'));
  assert.ok(g < pedir.indexOf("gerarCodigoAssinatura()"));
});
