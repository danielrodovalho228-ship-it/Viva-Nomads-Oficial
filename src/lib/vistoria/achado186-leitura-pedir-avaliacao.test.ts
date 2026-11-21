import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 186 (varredura "leitura que falha não vira outra resposta"): pedirAvaliacao lia o imóvel, a tabela de preços e
 * os bloqueios sem olhar o erro — a falha virava "sem acesso", "ainda não há preço" ou "anúncio não publicado".
 */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function pedirAvaliacao(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("pedirAvaliacao: leitura do imóvel com erro não vira 'sem acesso'", () => {
  assert.match(f, /const \{ data: im, error: erroImovel \} = await s\.admin\.from\("properties"\)/);
  const g = f.indexOf("if (erroImovel) return { ok: false, erro: MSG_VISTORIA_SEM_LEITURA };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("if (!im || im.owner_id !== s.userId) return SEM_ACESSO;"));
});

test("pedirAvaliacao: tabela de preços e bloqueios com erro não viram 'sem preço' nem 'anúncio não publicado'", () => {
  assert.match(f, /const \{ data: tabela, error: erroTabela \} = await s\.admin\.from\("vistoria_precos"\)/);
  assert.match(f, /const \{ data: bloq, error: erroBloq \} = await s\.admin\.from\("vistoria_bloqueios"\)/);
  const g = f.indexOf("if (erroTabela || erroBloq) return { ok: false, erro: MSG_VISTORIA_SEM_LEITURA };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("pedidoPodeAbrir("));
});
