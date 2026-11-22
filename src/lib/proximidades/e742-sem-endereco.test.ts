/*
  E742 (L-104, Pista C): "Qualificar o imóvel" abria o editor de um anúncio do próprio dono SEM CEP e SEM ponto gravado (a massa)
  e a API devolvia 400 "CEP inválido" (erro no console). Não é erro do navegador: não há endereço para buscar. Agora o dono sem
  endereço recebe 200 { itens: [], fonte: "sem_endereco" }; o 400 fica para entrada realmente inválida (CEP errado no corpo,
  anúncio de outra pessoa, ação "lugar" sem origem).
  Roda: node --test src/lib/proximidades/e742-sem-endereco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const r = readFileSync(new URL("../../app/api/proximidades/route.ts", import.meta.url), "utf8");

test("dono sem endereço: 200 'sem_endereco', sem lista", () => {
  assert.match(r, /const SEM_ENDERECO = "sem_endereco" as const;/);
  assert.match(r, /if \(!cep && !ponto\) return SEM_ENDERECO;/);
  assert.match(r, /if \(semEndereco && corpo\?\.acao !== "lugar" && !corpo\?\.cep\) return NextResponse\.json\(\{ itens: \[\], fonte: "sem_endereco" \}\);/);
});

test("o 400 'CEP inválido' continua para entrada inválida (outra pessoa, CEP errado no corpo, ação 'lugar')", () => {
  assert.match(r, /return NextResponse\.json\(\{ error: "CEP inválido\.", fonte: "sem_cep" \}, \{ status: 400 \}\);/);
  // Anúncio de outra pessoa continua null (não SEM_ENDERECO): a checagem do dono vem antes.
  assert.match(r, /if \(!p \|\| p\.owner_id !== userId\) return null;/);
  assert.ok(r.indexOf("if (!p || p.owner_id !== userId) return null;") < r.indexOf("if (!cep && !ponto) return SEM_ENDERECO;"));
});

test("a busca com ponto gravado (E593) segue igual", () => {
  assert.match(r, /const pontoGravado = !cep && doAnuncio\?\.ponto \? doAnuncio\.ponto : null;/);
});
