/*
  Prontidão do anúncio — fonte única de "o que falta para publicar".
  node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { fatosDaLinha, MIN_FOTOS, OBRIGATORIOS_ROTULOS, prontidaoAnuncio, type FatosAnuncio, type LinhaAnuncio } from "./prontidao.ts";
import { MIN_PHOTOS } from "../listing.ts";
import { FAQ } from "../atendimento/faq.ts";

/** Linha REAL do anúncio de teste ddf86c66 ("TESTE (não alugar)") em produção, 06/10/2026. */
const TESTE_DDF86C66: LinhaAnuncio = {
  title: "TESTE (não alugar) – Apto 2 quartos no Santa Mônica",
  address: "Saraiva",
  city: "Uberlândia",
  bathrooms: 1,
  area_m2: 65,
  min_period_days: 30,
  monthly_price: 2900,
  garantias_aceitas: ["caucao_avista"],
  ownership_type: "own",
  sublease_authorized: true,
  description: "x".repeat(219),
  ready_to_live_badge: false,
  video_url: null,
};

const completo = (): FatosAnuncio => fatosDaLinha(TESTE_DDF86C66, 8, "approved", true);

test("ddf86c66: 8 fotos + documento aprovado → pode publicar; selo e vídeo só como opcionais", () => {
  const p = prontidaoAnuncio(completo());
  assert.equal(p.podePublicar, true);
  assert.deepEqual(p.faltam, []);
  assert.equal(p.pct, 100);
  assert.deepEqual(p.melhorar, ["Selo Pronto para Morar", "Vídeo do imóvel"]);
});

test("opcionais (só Selo e Vídeo) NUNCA bloqueiam, nem entram no 'falta', nem baixam a %", () => {
  const sem = prontidaoAnuncio({ ...completo(), selo: false, video: false });
  const com = prontidaoAnuncio({ ...completo(), selo: true, video: true });
  assert.deepEqual(sem.opcionais.map((o) => o.key), ["selo", "video"]);
  assert.equal(sem.podePublicar, true);
  assert.deepEqual(sem.faltam, []);
  assert.equal(sem.pct, 100);
  assert.equal(com.pct, 100);
  assert.deepEqual(com.melhorar, []);
});

test("descrição é obrigatória (mín. 60 caracteres) e endereço está na lista", () => {
  const curta = prontidaoAnuncio({ ...completo(), descricao: "x".repeat(59) });
  assert.equal(curta.podePublicar, false);
  assert.deepEqual(curta.faltam, ["Descrição com 60+ caracteres (tem 59)"]);
  assert.ok(prontidaoAnuncio({ ...completo(), descricao: "x".repeat(60) }).podePublicar);
  assert.ok(OBRIGATORIOS_ROTULOS.includes("Endereço preenchido"));
  const semEndereco = fatosDaLinha({ ...TESTE_DDF86C66, address: "" }, 8, "approved", true);
  assert.deepEqual(prontidaoAnuncio(semEndereco).faltam, ["Endereço preenchido"]);
});

test("fotos abaixo do mínimo bloqueiam, com a contagem", () => {
  const p = prontidaoAnuncio({ ...completo(), fotos: 7 });
  assert.equal(p.podePublicar, false);
  assert.deepEqual(p.faltam, [`Pelo menos ${MIN_FOTOS} fotos (tem 7)`]);
  assert.equal(p.pct, 89); // 8 de 9 obrigatórios
});

test("documento: cada estado tem a sua explicação", () => {
  assert.match(prontidaoAnuncio({ ...completo(), documento: "pending" }).faltam[0], /em análise pela equipe/);
  assert.match(prontidaoAnuncio({ ...completo(), documento: "none" }).faltam[0], /ainda não enviado/);
  assert.match(prontidaoAnuncio({ ...completo(), documento: "rejected" }).faltam[0], /reprovado/);
});

test("sublocação sem autorização e plano sem vaga bloqueiam; limite null (editor) não", () => {
  const sub = fatosDaLinha({ ...TESTE_DDF86C66, ownership_type: "subleased", sublease_authorized: false }, 8, "approved", true);
  assert.deepEqual(prontidaoAnuncio(sub).faltam, ["Autorização de sublocação"]);
  const semVaga = prontidaoAnuncio({ ...completo(), limitePlanoOk: false });
  assert.equal(semVaga.podePublicar, false);
  assert.match(semVaga.faltam[0], /^Vaga no seu plano/);
  assert.equal(prontidaoAnuncio({ ...completo(), limitePlanoOk: null }).podePublicar, true);
});

test("anúncio vazio: nada cumprido, 0%", () => {
  const vazio = fatosDaLinha(
    { ...TESTE_DDF86C66, title: "", address: "", city: "", bathrooms: 0, area_m2: 0, min_period_days: 0, monthly_price: 0, garantias_aceitas: [], description: "" },
    0,
    "none",
    true
  );
  const p = prontidaoAnuncio(vazio);
  assert.equal(p.podePublicar, false);
  assert.equal(p.pct, 0);
  assert.equal(p.faltam.length, OBRIGATORIOS_ROTULOS.length);
});

test("fonte única: mínimo de fotos == MIN_PHOTOS do editor", () => {
  assert.equal(MIN_FOTOS, MIN_PHOTOS);
});

test("FAQ 'Por que meu anúncio não publica?' lista exatamente os obrigatórios da prontidão", () => {
  const faq = FAQ.find((p) => p.id === "anuncio-nao-publica");
  assert.ok(faq);
  for (const r of OBRIGATORIOS_ROTULOS) assert.ok(faq.resposta.toLowerCase().includes(r.toLowerCase()), r);
  assert.match(faq.resposta, /não impedem a publicação/);
});
