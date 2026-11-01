/*
  E399-C, pacote 5 — o aviso "preço igual ou acima" também no PAINEL do dono (lista "Meus imóveis"), além do Passo 8
  e do e-mail. Só o dono; chave PRECO_JUSTO_COMPARADOR; sem leitura, nenhum aviso.
  Roda: node --test src/lib/comparador-airbnb/pacote5.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("servidor: o aviso sai do motor (decidirSelo.avisoDono) e só na lista do dono, com a chave", () => {
  const srv = ler("src/lib/comparador-airbnb/comparacao-servidor.ts");
  const fn = srv.slice(srv.indexOf("export async function avisosDoMotor"));
  assert.match(fn, /if \(d\.avisoDono\) out\.set\(r\.property_id, d\.avisoDono\);/);
  assert.doesNotMatch(fn, /airbnb_id/);
  const dados = ler("src/lib/data/properties.ts");
  const minha = dados.slice(dados.indexOf("export async function listMyProperties"));
  assert.match(minha, /PRECO_JUSTO_COMPARADOR && lista\.length \? createAdminClient\(\) : null/);
  assert.match(minha, /avisosDoMotor\(adminPj, lista\.map\(\(p\) => p\.id\), new Date\(\)\)\.catch\(\(\) => null\)/);
  // A leitura pública (listProperties/getProperty) não carrega o aviso.
  assert.equal((dados.match(/avisoPrecoJusto/g) ?? []).length, 1);
});

test("tela: o cartão do dono mostra o valor no Airbnb e 'até R$ Y'", () => {
  const tela = ler("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(tela, /\{p\.avisoPrecoJusto && \(/);
  assert.match(tela, /data-testid="anuncio-preco-justo-aviso"/);
  assert.match(tela, /formatBRL\(p\.avisoPrecoJusto\.ate\)/);
});
