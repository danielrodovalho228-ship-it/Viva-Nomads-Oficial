/*
  E593 (laboratório, L-99): no editor do anúncio PUBLICADO a seção "O que tem por perto" não carregava — a chamada
  /api/proximidades ia só com o id do anúncio e a API devolvia 400 "CEP inválido" (390 e 1280 px). Causa: ao publicar,
  o servidor zera o draft_data (onde o CEP do rascunho mora) e o cep_proximidades só era gravado quando o editor mandava
  o endereço das proximidades junto — o anúncio publicado ficava SEM CEP (produção, 05/11: 6 de 11 ativos).
  Correção: (1) ao publicar, o CEP do rascunho vai para cep_proximidades ANTES de o draft_data ser zerado; (2) para os
  que já perderam o CEP, a API usa o PONTO gravado do próprio anúncio (lat_exata/lng_exata, senão lat/lng) como origem
  — o CEP só servia de chave do cache e para achar o ponto. Sem CEP, nada vai ao cache por CEP.
  Roda: node --test src/lib/proximidades/e593-editor-sem-cep.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("(1) publicar guarda o CEP do rascunho em cep_proximidades antes de zerar o draft_data", () => {
  const a = ler("lib/data/actions.ts");
  assert.match(a, /const cepDoRascunho = await cepDoRascunhoDoImovel\(id\);/);
  assert.match(a, /\.update\(\{ status: "active", draft_data: null, \.\.\.\(cepDoRascunho \? \{ cep_proximidades: cepDoRascunho \} : \{\}\) \}\)/);
  assert.ok(a.indexOf("const cepDoRascunho = await cepDoRascunhoDoImovel(id);") < a.indexOf('.update({ status: "active", draft_data: null'), "lê o CEP antes de zerar");
});

test("(2) a API: anúncio do próprio dono sem CEP usa o ponto gravado (sem 400 e sem cache por CEP)", () => {
  const r = ler("app/api/proximidades/route.ts");
  assert.match(r, /const pontoGravado = !cep && doAnuncio\?\.ponto \? doAnuncio\.ponto : null;/);
  // E742: sem CEP e sem ponto, o 400 segue para entrada inválida; o dono do anúncio sem endereço recebe 200 "sem_endereco".
  assert.match(r, /if \(!cep && !pontoGravado\) \{/);
  assert.match(r, /return NextResponse\.json\(\{ error: "CEP inválido\.", fonte: "sem_cep" \}, \{ status: 400 \}\);/);
  assert.match(r, /select\("owner_id, city, state, exact_address, draft_data, cep_proximidades, lat, lng, lat_exata, lng_exata"\)/);
  assert.match(r, /if \(pontoGravado\) \{/);
  // Sem CEP, nenhum upsert em proximidades_cep (a chave do cache é o CEP).
  const bloco = r.slice(r.indexOf("if (pontoGravado) {"), r.indexOf('if (!cep) return NextResponse.json({ error: "CEP inválido."'));
  assert.ok(bloco.length > 50, "o ramo sem CEP existe e vem antes da exigência do CEP");
  assert.doesNotMatch(bloco, /proximidades_cep/);
  assert.match(bloco, /buscarLugares\(pontoGravado, etapas\)/);
});

test("o endereço do anúncio só sai para o PRÓPRIO dono e nunca vai à resposta", () => {
  const r = ler("app/api/proximidades/route.ts");
  assert.match(r, /if \(!p \|\| p\.owner_id !== userId\) return null;/);
});
