/*
  E1048 — trava: na página pública do imóvel, o cartão do proprietário dizia "0 imóveis na Viva" com o dono tendo
  anúncios ativos (prova do Gerente: VN-1202DF, dono com 3 ativos). Causa: a contagem do cartão (E631) usa a lista
  da vitrine, que tira os anúncios de CONTA DE TESTE (E131) — e o dono das rondas é conta de teste (is_teste), então
  todos os anúncios dele saíam da conta, inclusive o próprio anúncio aberto na tela.
  Correção: quando o dono é conta de teste, o cartão conta os anúncios ativos dele (com os de teste); para o dono
  real nada muda (E631: o cartão conta o que a página pública lista).
  Roda: node --test src/lib/data/e1048-cartao-dono-contagem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartaoContaAnunciosDeTeste } from "../perfil/contagem-cartao-dono.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const props = ler("lib/data/properties.ts");
const perfil = ler("lib/data/perfil-proprietario.ts");

test("E1048 — dono conta de teste: o cartão conta os anúncios ativos dele (com os de teste)", () => {
  assert.equal(cartaoContaAnunciosDeTeste({ is_teste: true }), true);
});

test("E1048 — dono real (ou sem leitura): segue a contagem da vitrine (E631 intacto)", () => {
  assert.equal(cartaoContaAnunciosDeTeste({ is_teste: false }), false);
  assert.equal(cartaoContaAnunciosDeTeste({ is_teste: null }), false);
  assert.equal(cartaoContaAnunciosDeTeste(null), false);
  assert.equal(cartaoContaAnunciosDeTeste(undefined), false);
});

test("E1048 — a contagem aceita incluir os anúncios de teste e passa isso ao filtro da vitrine", () => {
  const conta = props.slice(props.indexOf("export async function contarImoveisPublicosDoDono"));
  assert.match(conta.slice(0, 200), /contarImoveisPublicosDoDono\(donoId: string, opcoes: \{ incluirTeste\?: boolean \} = \{\}\)/);
  assert.match(conta.slice(0, 800), /if \(opcoes\.incluirTeste === true\) return await contarAtivosDoDono\(supabase, donoId\);/);
  // a contagem do dono conta de teste: ativos do dono, sem o filtro de vitrine
  const ativos = props.slice(props.indexOf("async function contarAtivosDoDono("));
  assert.match(ativos.slice(0, 400), /\.eq\("owner_id", donoId\)\.eq\("status", "active"\)/);
  assert.doesNotMatch(ativos.slice(0, 400), /semAnunciosDeTeste/);
  // a lista pública do proprietário segue sem os anúncios de teste
  const lista = props.slice(props.indexOf("export async function listPropertiesDoProprietario"));
  assert.match(lista.slice(0, 600), /linhasPublicasDoDono\(supabase, donoId\)/);
});

test("E1048 — o perfil do cartão lê is_teste do dono e, só para conta de teste, conta com os de teste", () => {
  assert.match(perfil, /select\("full_name, is_teste"\)/);
  assert.match(perfil, /cartaoContaAnunciosDeTeste\(perfil\.data[^)]*\)\s*\?\s*await contarImoveisPublicosDoDono\(donoId, \{ incluirTeste: true \}\)\s*:\s*await contarImoveisPublicosDoDono\(donoId\)/);
});
