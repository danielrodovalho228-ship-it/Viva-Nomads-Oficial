/*
  PRESERVAR O VÍNCULO/SELO ATIVO — fluxo irmão: selo do LinkedIn. Teste PERMANENTE:
  1) uma conexão nova nunca apaga nem rebaixa o selo ativo: o único write do selo acontece DEPOIS de todas as conferências
     (token, nome, conta de outra pessoa); qualquer falha ou cancelamento volta antes de gravar;
  2) cancelamento/falha/expiração do fluxo novo mantêm o selo anterior (nenhum write antes do fim);
  3) a troca só com a conexão concluída pela própria pessoa (id_token conferido); apagar, só pelo "Desconectar" dela.
  Não remover nem afrouxar sem ordem do Daniel.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rota = readFileSync(new URL("../../app/api/conta/linkedin/retorno/route.ts", import.meta.url), "utf8");
const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test("retorno: um único write do selo, depois de todas as conferências", () => {
  const writes = rota.match(/from\("confianca_linkedin"\)\s*\.(upsert|update|insert|delete)\(/g) ?? [];
  assert.equal(writes.length, 1, "só um write do selo na rota");
  const w = rota.indexOf('.from("confianca_linkedin")\n    .upsert(');
  assert.ok(w > 0);
  for (const antes of ['return fim("cancelado")', "if (!conferido.ok) return fim(\"falha\")", 'return fim("nome")', 'return fim("outra")']) {
    const i = rota.indexOf(antes);
    assert.ok(i > 0 && i < w, `${antes} vem antes do write`);
  }
});

test("apagar o selo só pelo Desconectar da própria pessoa (id da sessão)", () => {
  const deletes = [...rota.matchAll(/confianca_linkedin"\)\.delete\(/g), ...acoes.matchAll(/confianca_linkedin"\)\.delete\(/g)];
  assert.equal(deletes.length, 1);
  const i = acoes.indexOf("export async function desconectarLinkedin(");
  const f = acoes.slice(i, acoes.indexOf("\n}\n", i));
  assert.match(f, /\.delete\(\)\.eq\("user_id", s\.uid\)/);
});
