/*
  E799 (D4): a prévia do perfil não oscila entre carregamentos. Roda: node --test src/lib/perfil/e799-espelho-estado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDoEspelho, papelDoPerfilPublico } from "./espelho-estado.ts";

test("enquanto a leitura não chega, ou quando falha, a prévia NUNCA chuta o cartão de morador", () => {
  for (const papelDoModo of ["morador", "proprietario"] as const) {
    assert.equal(estadoDoEspelho({ leitura: "carregando", ehDono: false, papelDoModo, visto: null }), "carregando");
    assert.equal(estadoDoEspelho({ leitura: "falha", ehDono: false, papelDoModo, visto: null }), "falha");
  }
});

test("lida: o dono vê o cartão do papel em uso (ou o 'ver como'); quem não anuncia vê o de morador", () => {
  assert.equal(estadoDoEspelho({ leitura: "ok", ehDono: true, papelDoModo: "proprietario", visto: null }), "proprietario");
  assert.equal(estadoDoEspelho({ leitura: "ok", ehDono: true, papelDoModo: "morador", visto: null }), "morador");
  assert.equal(estadoDoEspelho({ leitura: "ok", ehDono: true, papelDoModo: "proprietario", visto: "morador" }), "morador");
  assert.equal(estadoDoEspelho({ leitura: "ok", ehDono: false, papelDoModo: "proprietario", visto: null }), "morador");
});

test("servidor: ser dono é TER IMÓVEL; falha na leitura é falha, nunca 'morador'", () => {
  assert.equal(papelDoPerfilPublico(true, true), "dono");
  assert.equal(papelDoPerfilPublico(true, false), "falha", "a faixa do dono não veio: falha (antes virava morador)");
  assert.equal(papelDoPerfilPublico(null, false), "falha");
  assert.equal(papelDoPerfilPublico(false, false), "morador");
});

test("as telas usam a fonte única: espelho por estado; o servidor não converte falha em morador", () => {
  const tela = readFileSync("src/components/account/espelho-papel.tsx", "utf8");
  assert.match(tela, /estadoDoEspelho\(/);
  assert.match(tela, /data-testid="espelho-carregando"/);
  assert.match(tela, /data-testid="espelho-falha"/);
  assert.doesNotMatch(tela, /const papel: Papel = !ehDono \? "morador"/, "o atalho antigo (sem leitura = morador) saiu");
  const srv = readFileSync("src/lib/data/papeis-actions.ts", "utf8");
  assert.match(srv, /papelDoPerfilPublico\(/);
  assert.doesNotMatch(srv, /getPerfilProprietario\(user\.id\)\.catch\(\(\) => null\)/, "a falha da faixa não vira 'não é dono'");
});
