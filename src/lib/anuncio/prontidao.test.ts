/*
  Prontidão do anúncio — fonte única de "o que falta para publicar".
  node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import { checklistAnuncio, faixaDocumentoAprovado, fatosDaLinha, MIN_FOTOS, OBRIGATORIOS_ROTULOS, prontidaoAnuncio, type FatosAnuncio, type LinhaAnuncio } from "./prontidao.ts";
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

test("'100% · Pronto para publicar' em Meus imóveis, Visão geral e editor", () => {
  const ler = (p: string) => readFileSync(new URL(`../../app/(dashboard)/dashboard/${p}`, import.meta.url), "utf8");
  for (const p of ["imoveis/imoveis-client.tsx", "visao-geral-client.tsx", "imoveis/[id]/editar/editar-client.tsx"]) assert.match(ler(p), /100% · [Pp]ronto para publicar/, p);
});

test("rótulos do documento na prontidão: Não enviado / Em análise / Aprovado / Reprovado: motivo", async () => {
  const { rotuloDocumento } = await import("./prontidao.ts");
  assert.equal(rotuloDocumento("none"), "Não enviado");
  assert.equal(rotuloDocumento("pending"), "Em análise");
  assert.equal(rotuloDocumento("approved"), "Aprovado");
  assert.equal(rotuloDocumento("rejected", "Foto ilegível"), "Reprovado: Foto ilegível");
  assert.equal(rotuloDocumento("rejected", "  "), "Reprovado");
});



test("#58: rascunho com documento aprovado mostra a faixa e o que falta", () => {
  const comp = prontidaoAnuncio({ ...completo(), documento: "approved", fotos: 3 });
  const faixa = faixaDocumentoAprovado(comp, "draft");
  assert.equal(faixa?.titulo, "Documento aprovado — falta publicar");
  assert.ok(faixa?.faltam.some((f) => f.includes("fotos")));
});

test("#58: tudo pronto vira 'é só publicar'; documento não aprovado ou anúncio ativo não mostram faixa", () => {
  const pronto = prontidaoAnuncio({ ...completo(), documento: "approved" });
  assert.equal(faixaDocumentoAprovado(pronto, "draft")?.titulo, "Documento aprovado — é só publicar");
  assert.equal(faixaDocumentoAprovado(pronto, "active"), null);
  const pendente = prontidaoAnuncio({ ...completo(), documento: "pending" });
  assert.equal(faixaDocumentoAprovado(pendente, "draft"), null);
});

test("checklist do anúncio em andamento: ✓/○, cada pendência leva à etapa certa e o próximo passo vem em destaque", () => {
  const p = prontidaoAnuncio({ ...completo(), fotos: 3, documento: "pending", descricao: "curta" });
  const c = checklistAnuncio(p, "abc-123");
  assert.equal(c.itens.length, p.obrigatorios.length);
  assert.equal(c.itens.filter((i) => !i.ok).length, p.faltam.length);
  assert.equal(c.proximo?.key, "fotos");
  // Assistente em 10 passos: 0 Tipo · 1 Fotos · 2 Endereço · 3 Detalhes · 4 Comodidades · 5 Regras · 6 Descrição ·
  // 7 Preço · 8 Disponibilidade · 9 Revisão.
  assert.equal(c.proximo?.href, "/dashboard/imoveis/novo?draft=abc-123&etapa=1");
  assert.equal(c.itens.find((i) => i.key === "descricao")?.href, "/dashboard/imoveis/novo?draft=abc-123&etapa=6");
  // E104: o documento é enviado e conferido no cartão "Antes de publicar" da Revisão (o Passo 3 é só endereço).
  assert.equal(c.itens.find((i) => i.key === "documento")?.href, "/dashboard/imoveis/novo?draft=abc-123&etapa=9");
  assert.equal(c.itens.find((i) => i.key === "endereco")?.ok, true);
});

test("checklist: tudo feito → sem próximo passo; vaga no plano leva à página do plano", () => {
  assert.equal(checklistAnuncio(prontidaoAnuncio(completo()), "x").proximo, null);
  const lim = checklistAnuncio(prontidaoAnuncio({ ...completo(), limitePlanoOk: false }), "x");
  assert.equal(lim.proximo?.href, "/precos");
});

test("vaga no plano: texto curto com o número, 2 botões, e só aparece se for o único bloqueio", () => {
  const um = prontidaoAnuncio({ ...completo(), limitePlanoOk: false, limiteAnuncios: 1 });
  assert.equal(um.obrigatorios.find((i) => i.key === "limite")?.detalhe, "Seu plano permite 1 anúncio no ar. Para publicar este, pause outro ou mude de plano");
  assert.match(prontidaoAnuncio({ ...completo(), limitePlanoOk: false, limiteAnuncios: 3 }).faltam[0], /permite 3 anúncios no ar/);
  const acoes = checklistAnuncio(um, "x").proximo?.acoes;
  assert.deepEqual(acoes?.map((a) => a.href), ["/dashboard/imoveis", "/precos"]);
  // Com outra pendência (fotos), a vaga ainda não é mostrada.
  const outro = prontidaoAnuncio({ ...completo(), fotos: 0, limitePlanoOk: false, limiteAnuncios: 1 });
  assert.equal(outro.obrigatorios.some((i) => i.key === "limite"), false);
  assert.equal(outro.faltam.length, 1);
});

test("checklist: o id do rascunho vai codificado na URL", () => {
  const c = checklistAnuncio(prontidaoAnuncio({ ...completo(), fotos: 0 }), "a&b=1");
  assert.ok(c.proximo?.href.includes("draft=a%26b%3D1"));
});

import { ROTULO_QUALIFICACAO } from "./prontidao.ts";

test("p22 — portão único: no cadastro, 'Antes de anunciar' é item da mesma lista desde o início; fora dele não aparece", () => {
  const fatos = {
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio mobiliado", preco: 3000, garantiaOk: true,
    sublocacaoOk: true, privacidadeOk: true, documento: "approved" as const, limitePlanoOk: null, descricao: "x".repeat(200), selo: false, video: false,
  };
  const sem = prontidaoAnuncio({ ...fatos, qualificacaoOk: false });
  const item = sem.obrigatorios.find((i) => i.key === "qualificacao");
  assert.ok(item);
  assert.equal(item.label, ROTULO_QUALIFICACAO);
  assert.equal(item.ok, false);
  assert.equal(sem.podePublicar, false, "sem a qualificação não publica — e isso aparece na lista, não num segundo bloqueio");
  assert.ok(sem.faltam.some((f) => f.startsWith(ROTULO_QUALIFICACAO)));
  assert.equal(prontidaoAnuncio({ ...fatos, qualificacaoOk: true }).podePublicar, true);
  assert.equal(prontidaoAnuncio(fatos).obrigatorios.some((i) => i.key === "qualificacao"), false, "editor/lista: não se aplica");
});

test("65-B: o fato Vídeo vale para arquivo enviado OU link; 'Para melhorar: Vídeo do imóvel' aponta para o campo", async () => {
  const { hrefParaMelhorar, ANCORA_VIDEO_EDITOR, ANCORA_VIDEO_ASSISTENTE } = await import("./prontidao.ts");
  const dono = "11111111-1111-4111-8111-111111111111";
  assert.equal(fatosDaLinha({ ...TESTE_DDF86C66, video_arquivo: `${dono}/v-10s.mp4` }, 8, "approved", true).video, true);
  assert.equal(fatosDaLinha({ ...TESTE_DDF86C66, video_url: "https://youtu.be/dQw4w9WgXcQ" }, 8, "approved", true).video, true);
  assert.equal(fatosDaLinha({ ...TESTE_DDF86C66, video_url: "https://evil.com/v" }, 8, "approved", true).video, false);
  assert.equal(completo().video, false);

  // Anúncio existente → seção Vídeo do editor por seções; rascunho no assistente → bloco de vídeo do passo Fotos.
  assert.equal(hrefParaMelhorar("video", "abc", false), `/dashboard/imoveis/abc/editar#${ANCORA_VIDEO_EDITOR}`);
  assert.equal(hrefParaMelhorar("video", "abc", true), `/dashboard/imoveis/novo?draft=abc&etapa=1#${ANCORA_VIDEO_ASSISTENTE}`);
  assert.equal(hrefParaMelhorar("selo", "abc", false), null);

  // O destino tem o campo: a âncora existe no editor (seção com o enviador) e no passo Fotos (bloco com o enviador).
  const editor = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", import.meta.url), "utf8");
  assert.match(editor, /ancora=\{ANCORA_VIDEO_EDITOR\}[\s\S]{0,400}<VideoUploader path=\{videoArquivo\}[^\n]*onVideoUrlChange=\{setVideoUrl\}/);
  const fotos = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx", import.meta.url), "utf8");
  assert.match(fotos, /id=\{ANCORA_VIDEO_ASSISTENTE\}[\s\S]{0,300}<VideoUploader [^\n]*onVideoUrlChange=\{setVideoUrl\}/);
  // No assistente o bloco vem depois do envio de fotos e ANTES da caixa da IA.
  assert.ok(fotos.indexOf("<PhotoUploader") < fotos.indexOf('data-testid="bloco-video"'));
  assert.ok(fotos.indexOf('data-testid="bloco-video"') < fotos.indexOf('data-testid="ia-fotos"'));
  assert.doesNotMatch(fotos, /Link do vídeo do imóvel/, "o campo antigo misturado saiu");
});
