/*
  Estados vazios / falha de leitura — conta:
  1. usarPapel (troca automática ao abrir outra área): sem ler intenção e papel ativo, a conta NÃO passa por "1º acesso"
     (que só gravava o modo e respondia ok sem trocar o papel). Agora não grava nada e devolve o erro.
  2. mesclarFavoritosConvidado: sem ler os favoritos da conta, não responde ok com só os do aparelho (o coração e a lista
     mostravam a conta "sem favoritos" e a sessão não tentava de novo). Agora responde ok: false e a mescla tenta de novo.
  Roda: node --test src/lib/vazio-papel-favoritos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const trecho = (src: string, inicio: string) => {
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, inicio);
  return src.slice(i, src.indexOf("\n}\n", i));
};

test("usarPapel: leitura falha na troca automática não vira 1º acesso; nada é gravado", () => {
  const c = trecho(ler("src/lib/data/papel-actions.ts"), "export async function usarPapel(");
  assert.match(c, /\{ data: atual, error: erroAtual \}/);
  assert.match(c, /if \(erroAtual\) return \{ ok: false, erro: /);
  assert.ok(c.indexOf("if (erroAtual)") < c.indexOf("contaNoPrimeiroAcesso("));
});

test("favoritos do convidado: leitura falha da conta responde ok: false antes de inserir", () => {
  const c = trecho(ler("src/lib/data/convidado-actions.ts"), "export async function mesclarFavoritosConvidado(");
  assert.match(c, /\{ data, error \} = await s\.supabase\.from\("favorites"\)/);
  assert.match(c, /if \(error\) return \{ ok: false, ids: \[\] \}/);
  assert.ok(c.indexOf("if (error) return") < c.indexOf('.from("favorites").insert('));
  // A tela só conclui a mescla com ok (assim tenta de novo depois).
  assert.match(ler("src/lib/convidado/mesclar.ts"), /const r = await a\.mesclarFavoritosConvidado\(pendentes\);\s+if \(r\.ok\) \{/);
});
