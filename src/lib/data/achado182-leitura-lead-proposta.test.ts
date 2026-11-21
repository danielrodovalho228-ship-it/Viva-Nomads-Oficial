import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 182 (varredura "leitura que falha não vira outra resposta"): ao enviar e ao aceitar uma proposta, a leitura do
 * lead sem olhar o erro virava "Escolha um interessado da sua lista" / "Esta candidatura não está mais em andamento".
 */
const fonte = readFileSync(new URL("./propostas-actions.ts", import.meta.url), "utf8");
const enviar = fonte.slice(fonte.indexOf("export async function enviarProposta("), fonte.indexOf("\n}\n", fonte.indexOf("export async function enviarProposta(")) + 2);
const aceitar = fonte.slice(fonte.indexOf("async function aceitar("));

test("enviarProposta: leitura do lead com erro não vira 'Escolha um interessado da sua lista'", () => {
  assert.match(enviar, /const \{ data: lead, error: erroLead \} = await s\.admin\.from\("leads"\)/);
  const g = enviar.indexOf("if (erroLead)");
  assert.ok(g >= 0);
  assert.match(enviar.slice(g, g + 150), /Não foi possível ler a candidatura agora/);
  assert.ok(g < enviar.indexOf("Escolha um interessado da sua lista."));
});

test("aceitar: leitura do lead com erro não vira 'candidatura não está mais em andamento'", () => {
  assert.match(aceitar, /const \{ data: lead, error: erroLead \} = await admin\.from\("leads"\)/);
  const g = aceitar.indexOf("if (erroLead)");
  assert.ok(g >= 0);
  assert.match(aceitar.slice(g, g + 150), /Não foi possível ler a candidatura agora/);
  assert.ok(g < aceitar.indexOf("Esta candidatura não está mais em andamento."));
});
