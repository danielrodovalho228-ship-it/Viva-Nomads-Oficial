/*
  E1097 (ORDEM-DUET-454/455, decisão do Daniel de 22/11): o selo público "Avaliador credenciado" para TODOS os
  avaliadores credenciados — na listagem (/avaliadores/<cidade>) e no perfil público. Antes, o credenciado entrava na
  listagem com `selo: null` e o perfil dizia "Avaliador credenciado da Viva".
  "Avaliador sócio da Viva" fica EXCLUSIVO do Rogério: vem só da linha dele em avaliadores_perfil_publico (0349), nunca
  de uma regra geral. Quando o credenciamento dele se ligar a essa linha (credenciamento_id), o selo dele continua o de
  sócio e ele não aparece duas vezes na listagem.
  Conta de teste: continua "Avaliador em teste" (E717).
  Roda: node --test src/lib/vistoria/e1097-selo-publico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_AVALIADOR_CREDENCIADO, ROTULO_AVALIADOR_EM_TESTE, SELO_AVALIADOR_SOCIO } from "./regras.ts";
import { seloDoCredenciado } from "./vitrine-avaliadores.ts";

test("E1097: o rótulo público do credenciado é 'Avaliador credenciado'", () => {
  assert.equal(ROTULO_AVALIADOR_CREDENCIADO, "Avaliador credenciado");
  assert.equal(SELO_AVALIADOR_SOCIO, "Avaliador sócio da Viva");
});

test("E1097: todo credenciado leva o selo; a conta de teste, 'em teste'; o sócio só pela linha ligada do Rogério", () => {
  assert.equal(seloDoCredenciado(false, null), "Avaliador credenciado");
  assert.equal(seloDoCredenciado(true, null), ROTULO_AVALIADOR_EM_TESTE);
  assert.equal(seloDoCredenciado(false, SELO_AVALIADOR_SOCIO), SELO_AVALIADOR_SOCIO, "a linha ligada do Rogério mantém o sócio");
  assert.equal(seloDoCredenciado(true, SELO_AVALIADOR_SOCIO), ROTULO_AVALIADOR_EM_TESTE, "conta de teste nunca se apresenta como sócio");
  assert.equal(seloDoCredenciado(false, "  "), "Avaliador credenciado");
});

test("E1097: a listagem dá o selo aos credenciados (nada de selo: null) e não repete o perfil ligado", () => {
  const srv = readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8");
  assert.doesNotMatch(srv, /selo: null,/);
  assert.match(srv, /selo: seloDoCredenciado\(teste, seloLigado\.get\(a\.numero_credenciado\) \?\? null\)/);
  assert.match(srv, /select\("numero, nome_publico, cidade, selo, credenciamento_id"\)/);
  assert.match(srv, /\.filter\(\(p\) => !p\.credenciamento_id \|\| !numeroDoCred\.has\(p\.credenciamento_id\)\)/);
});

test("E1097: o perfil público do credenciado mostra o mesmo selo da listagem", () => {
  const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
  assert.match(pagina, /data-testid="avaliador-rotulo">\{seloDoCredenciado\(a\.teste, seloLigado\)\}/);
  assert.match(pagina, /const seloLigado = admin \? await seloLigadoDoCredenciado\(admin, a\.numero_credenciado\) : null;/);
});
