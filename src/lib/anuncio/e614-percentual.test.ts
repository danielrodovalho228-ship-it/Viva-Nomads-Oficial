/*
  E614: o "N% pronto" do assistente não tinha granularidade — 36% parado nos Passos 5–7, salto a 50% ao ENTRAR no
  Passo 8 (o preço sugerido da região entrava sozinho) e 50% congelado nos Passos 9–10 (preço, garantia e período
  mínimo já contavam pelo valor padrão/sugerido, então completá-los não mexia no número). E os itens que só existem
  enquanto faltam (internet, privacidade, tipo de entrada, padrão mínimo) saíam da conta ao serem resolvidos, em vez
  de contar como feitos.
  Roda: node --test src/lib/anuncio/e614-percentual.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { fatosDoRascunho } from "./fatos-do-rascunho.ts";
import { CONFIRMAVEIS, confirmadosAoContinuar, lerConfirmados } from "./confirmados.ts";
import { ETAPA } from "./etapas-ids.ts";

const base = (): FatosAnuncio => ({
  enderecoOk: true,
  detalhesOk: true,
  periodoOk: false,
  fotos: 8,
  titulo: "",
  preco: 0,
  garantiaOk: false,
  sublocacaoOk: true,
  privacidadeOk: false,
  operacao: "own",
  documento: "none",
  descricao: "",
  qualificacaoOk: false,
  tipoEntradaOk: false,
  internetOk: false,
  confortoFaltam: 3,
  selo: false,
  video: false,
});

test("E614: resolver um item condicional SOBE o número (conta como feito, não some da conta)", () => {
  const antes = prontidaoAnuncio(base()).pct;
  const comInternet = prontidaoAnuncio({ ...base(), internetOk: true }).pct;
  const comPrivacidade = prontidaoAnuncio({ ...base(), internetOk: true, privacidadeOk: true }).pct;
  const comEntrada = prontidaoAnuncio({ ...base(), internetOk: true, privacidadeOk: true, tipoEntradaOk: true }).pct;
  const comConforto = prontidaoAnuncio({ ...base(), internetOk: true, privacidadeOk: true, tipoEntradaOk: true, confortoFaltam: 0 }).pct;
  assert.ok(antes < comInternet && comInternet < comPrivacidade && comPrivacidade < comEntrada && comEntrada < comConforto, `${antes} ${comInternet} ${comPrivacidade} ${comEntrada} ${comConforto}`);
  // mesmo denominador: 13 itens aplicáveis (9 + qualificação + entrada + internet + privacidade + conforto = 14)
  assert.equal(antes, Math.round((3 / 14) * 100)); // endereço, detalhes, fotos
  assert.equal(comConforto, Math.round((7 / 14) * 100));
});

test("E614: tudo feito segue 100%; o portão (podePublicar/faltam) não muda", () => {
  const tudo: FatosAnuncio = { ...base(), periodoOk: true, titulo: "Apto", descricao: "x".repeat(80), preco: 3000, garantiaOk: true, privacidadeOk: true, documento: "approved", qualificacaoOk: true, tipoEntradaOk: true, internetOk: true, confortoFaltam: 0 };
  const p = prontidaoAnuncio(tudo);
  assert.equal(p.pct, 100);
  assert.equal(p.podePublicar, true);
  // valores não confirmados pelo dono não contam no número, mas não viram "falta" no portão
  const nc = prontidaoAnuncio({ ...tudo, naoConfirmados: ["preco", "garantia", "periodo"] });
  assert.equal(nc.podePublicar, true);
  assert.deepEqual(nc.faltam, []);
  assert.ok(nc.pct < 100);
});

test("E614: preço sugerido, garantia e período padrão só contam depois de o dono confirmar", () => {
  const rascunho = { minPeriod: "30", monthlyPrice: "3200", garantias: { caucao_avista: true } };
  const semConfirmar = prontidaoAnuncio(fatosDoRascunho({ ...rascunho, confirmados: [] }, base())).pct;
  const comPreco = prontidaoAnuncio(fatosDoRascunho({ ...rascunho, confirmados: ["preco", "garantia"] }, base())).pct;
  const comTudo = prontidaoAnuncio(fatosDoRascunho({ ...rascunho, confirmados: ["preco", "garantia", "periodo"] }, base())).pct;
  assert.ok(semConfirmar < comPreco && comPreco < comTudo, `${semConfirmar} ${comPreco} ${comTudo}`);
  // rascunho antigo (sem a chave) e anúncio publicado: nada muda
  const antigo = prontidaoAnuncio(fatosDoRascunho(rascunho, base())).pct;
  assert.equal(antigo, comTudo);
  const publicado = prontidaoAnuncio(fatosDoRascunho({ ...rascunho, confirmados: [] }, base(), { publicado: true })).pct;
  assert.equal(publicado, prontidaoAnuncio(fatosDoRascunho(rascunho, base(), { publicado: true })).pct);
});

test("E614: Continuar no Passo 8 confirma preço e garantia; no Passo 9, o período", () => {
  assert.deepEqual(confirmadosAoContinuar(ETAPA.preco), ["preco", "garantia"]);
  assert.deepEqual(confirmadosAoContinuar(ETAPA.disponibilidade), ["periodo"]);
  assert.deepEqual(confirmadosAoContinuar(ETAPA.descricao), []);
  assert.deepEqual(lerConfirmados(["preco", "x", 3, "periodo"]), ["preco", "periodo"]);
  assert.equal(lerConfirmados(undefined), null);
  assert.deepEqual([...CONFIRMAVEIS], ["preco", "garantia", "periodo"]);
});

test("E614: o assistente grava os confirmados no rascunho e confirma ao continuar e ao mexer no campo", () => {
  const fonte = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(fonte, /confirmadosAoContinuar\(step\)/);
  assert.match(fonte, /lerConfirmados\(d\.confirmados\)/);
  assert.match(fonte, /\.\.\.\(confirmados \? \{ confirmados \} : \{\}\)/);
  assert.match(fonte, /setMonthlyPrice=\{\(v\) => \{[^}]*confirmar\("preco"\)/);
  assert.match(fonte, /setMinPeriod=\{\(v\) => \{[^}]*confirmar\("periodo"\)/);
});

test("E614: confirmar ao continuar é navegação (não carimba \"Salvo às\")", async () => {
  const { conteudoDoRascunho } = await import("./salvo-fantasma.ts");
  assert.equal(conteudoDoRascunho(JSON.stringify({ title: "A", confirmados: ["preco"] })), conteudoDoRascunho(JSON.stringify({ title: "A", confirmados: [] })));
});
