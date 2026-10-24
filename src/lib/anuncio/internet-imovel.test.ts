/*
  E102-B — "Não tem internet" na chácara/sítio: resposta válida (salva o rascunho), mas não publica. O motivo é a falta
  de internet (padrão mínimo, item "Internet informada" do Essencial), não a velocidade em branco.
  Roda: node --test src/lib/anuncio/internet-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { INTERNETS_CHACARA, chacaraDoFormulario, faltaChacara, linhaChacara, normalizarChacara } from "./chacara.ts";
import { MOTIVO_SEM_INTERNET, SEM_INTERNET, SEM_INTERNET_NO_IMOVEL, temInternet, tipoInternetDoAnuncio } from "./internet-imovel.ts";
import { ITENS_CONFORTO } from "../../config/conforto-minimo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const BASE: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Chácara do Lab", preco: 3000, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", limitePlanoOk: true, descricao: "x".repeat(80), selo: false, video: false,
};

test("a opção 'Não tem internet' existe e é resposta válida (o rascunho guarda; o tipo de internet conta como respondido)", () => {
  assert.ok(INTERNETS_CHACARA.some((o) => o.valor === "nao_tem" && o.rotulo === "Não tem internet"));
  assert.equal(SEM_INTERNET, "nao_tem");
  assert.deepEqual(normalizarChacara({ acesso: "terra", internet: "nao_tem" }), { acesso: "terra", internet: "nao_tem" });
  assert.equal(chacaraDoFormulario({ acesso: "asfalto", internet: "nao_tem" }).dados.internet, "nao_tem");
  assert.deepEqual(faltaChacara({ acesso: "terra", internet: "nao_tem", pontoMarcado: true }), []);
  assert.equal(linhaChacara({ acesso: "terra", internet: "nao_tem" }), "Acesso: estrada de terra · sem internet");
});

test("temInternet: só 'nao_tem' diz que não; uma função para qualquer tipo com a pergunta", () => {
  assert.equal(temInternet("nao_tem"), false);
  for (const v of ["fibra", "radio", "satelite", "movel", null, undefined]) assert.equal(temInternet(v), true, String(v));
  assert.equal(tipoInternetDoAnuncio("chacara", { chacara: { internet: "nao_tem" } }), "nao_tem");
  assert.equal(tipoInternetDoAnuncio("apartamento", { chacara: { internet: "nao_tem" } }), null, "grupo de chácara que sobrou em outro tipo não conta");
  assert.equal(tipoInternetDoAnuncio("chacara", null), null);
  // O item do padrão mínimo que o motivo cita.
  assert.ok(ITENS_CONFORTO.some((i) => i.chave === "internet_informada" && i.rotulo === "Internet informada"));
});

test("publicar com 'nao_tem' é barrado com o motivo certo, e os Mbps vazios não viram um segundo motivo", () => {
  const p = prontidaoAnuncio({ ...BASE, internetOk: false, semInternet: true, chacaraFaltam: [] });
  assert.equal(p.podePublicar, false);
  assert.deepEqual(p.faltam, ['Internet: o padrão mínimo da Viva exige internet no imóvel (item "Internet informada" do Essencial).']);
  assert.equal(p.faltam[0], MOTIVO_SEM_INTERNET);
  assert.ok(!p.obrigatorios.some((i) => i.key === "internet"));
});

test("trocar para Fibra: o campo de velocidade volta a ser obrigatório; com a velocidade, publica", () => {
  const semMbps = prontidaoAnuncio({ ...BASE, internetOk: false, semInternet: undefined, chacaraFaltam: [] });
  assert.equal(semMbps.podePublicar, false);
  assert.ok(semMbps.obrigatorios.some((i) => i.key === "internet" && !i.ok));
  assert.equal(prontidaoAnuncio({ ...BASE, internetOk: true, chacaraFaltam: [] }).podePublicar, true);
});

test("a mesma regra no servidor (portão do Publicar), no cadastro, no editor e no Passo 5", () => {
  const srv = ler("src/lib/anuncio/prontidao-servidor.ts");
  assert.match(srv, /temInternet\(tipoInternetDoAnuncio\(r\.property_type, r\.detalhes_anuncio\)\)/);
  assert.match(srv, /f\.semInternet = true/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /temInternet\(tipoInternetDoAnuncio\(propertyType, \{ chacara \}\)\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), /temInternet\(tipoInternetDoAnuncio\(property\.propertyType, \{ chacara \}\)\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"), /semInternet=\{p\.semInternet\}/);
  const bloco = ler("src/components/anuncio/blocos-cadastro.tsx");
  assert.match(bloco, /semInternet \? \(/);
  assert.equal(SEM_INTERNET_NO_IMOVEL, "Sem internet no imóvel");
});
