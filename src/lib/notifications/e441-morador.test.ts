/*
  E441, parte B/e-mails (Relay 51): o e-mail ao dono sobre pedido/orçamento do morador traz a foto de perfil dele,
  clicável para o detalhe da solicitação, junto do nome (datas, valores e número seguem no quadro de dados). Sem foto,
  ou antes do aceite (mesma regra do calendário com foto), o avatar com as iniciais. Texto puro sem imagem nem URL dela.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blocoMoradorHtml, fotoParaOEmail, linhasMoradorTexto, urlAvatarEmail } from "./morador-email.ts";
import { montarNotificacao } from "./montar-email.ts";

const SITE = "https://vivanomads.com.br";
const DONO = "11111111-1111-1111-1111-111111111111";
const MORADOR = "22222222-2222-2222-2222-222222222222";
const SIG = "0123456789abcdef0123456789abcdef";
const URL_DETALHE = `${SITE}/dashboard/propostas/abc`;
const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("com foto (relação aceita): a foto do morador, clicável para o detalhe, junto do nome", () => {
  const foto = urlAvatarEmail(SITE, DONO, MORADOR, SIG)!;
  assert.equal(foto, `${SITE}/api/email/avatar?d=${DONO}&m=${MORADOR}&s=${SIG}`);
  const html = blocoMoradorHtml({ nome: "Ana Souza", fotoUrl: foto, url: URL_DETALHE });
  assert.ok(html.includes(`<a href="${URL_DETALHE}" style="text-decoration:none;"><img src="${foto}"`), "foto clicável");
  assert.ok(html.includes(`<a href="${URL_DETALHE}" class="vn-t"`) && html.includes("Ana Souza"), "nome clicável");
  assert.doesNotMatch(html, /data-iniciais/);
});

test("sem foto ou antes do aceite: avatar com as iniciais (HTML puro, nada para quebrar)", () => {
  assert.equal(fotoParaOEmail({ relacaoAceita: false, temFoto: true, url: "x" }), null, "antes do aceite: nunca a foto");
  assert.equal(fotoParaOEmail({ relacaoAceita: true, temFoto: false, url: "x" }), null, "sem foto");
  assert.equal(fotoParaOEmail({ relacaoAceita: true, temFoto: true, url: "x" }), "x");
  const html = blocoMoradorHtml({ nome: "Ana Souza", fotoUrl: null, url: URL_DETALHE });
  assert.match(html, /<span data-iniciais[^>]*>AS<\/span>/);
  assert.doesNotMatch(html, /<img/);
  assert.ok(html.includes(`<a href="${URL_DETALHE}"`));
});

test("URL da foto só com ids e assinatura no formato certo", () => {
  assert.equal(urlAvatarEmail(SITE, "x", MORADOR, SIG), null);
  assert.equal(urlAvatarEmail(SITE, DONO, MORADOR, "curta"), null);
});

test("texto puro: nome e link da solicitação; nunca imagem nem URL de imagem", () => {
  const t = linhasMoradorTexto({ nome: "Ana Souza", fotoUrl: urlAvatarEmail(SITE, DONO, MORADOR, SIG), url: URL_DETALHE }, "Ver a proposta");
  assert.equal(t, `Morador: Ana Souza\nVer a proposta: ${URL_DETALHE}`);
  assert.doesNotMatch(t, /api\/email\/avatar|<img/);
});

test("o bloco da pessoa (com links) não tira o botão do e-mail", () => {
  const bloco = blocoMoradorHtml({ nome: "Ana", fotoUrl: null, url: URL_DETALHE });
  const m = montarNotificacao({ siteUrl: SITE, event: "proposta_recebida", detailsHtml: bloco + "<p>dados</p>", pushUrl: "/dashboard/propostas/abc" });
  assert.ok(m.botao, "botão continua");
  assert.ok(m.html.indexOf("data-morador-email") < m.html.indexOf("<p>dados</p>"), "pessoa antes dos dados");
  // Link de verdade nos detalhes (ex.: "Responder pela plataforma") segue tirando o botão, como antes.
  assert.equal(montarNotificacao({ siteUrl: SITE, event: "proposta_recebida", detailsHtml: '<a href="/x">Responder</a>' }).botao, null);
});

test("servidor: foto só com relação aceita conferida no envio E na abertura; proposta e candidatura ao dono usam o bloco", () => {
  const srv = ler("./morador-email-servidor.ts");
  assert.match(srv, /relacaoAceitaEntreServidor\(p\.donoId, p\.moradorId\)/);
  assert.match(srv, /aceita \? nomeDepoisDoAceite\(cheio\) : primeiroNome\(cheio\)/);
  assert.match(srv, /crypto\.timingSafeEqual/);
  const rota = ler("../../app/api/email/avatar/route.ts");
  assert.match(rota, /!assinaturaAvatarValida\(d, m, q\.get\("s"\) \?\? ""\)\) return nada\(\)/);
  assert.match(rota, /if \(!\(await relacaoAceitaEntreServidor\(d, m\)\.catch\(\(\) => false\)\)\) return nada\(\)/);
  const prop = ler("../data/propostas-actions.ts");
  assert.match(prop, /papelDestino === "owner" && de === "tenant"\s*\? await moradorNoEmail\(/);
  assert.match(prop, /\(pessoa\?\.html \?\? ""\) \+/);
  const act = ler("../data/actions.ts");
  assert.match(act, /moradorNoEmail\(\{ donoId: ownerId, moradorId: user\.id, caminho: linkCandidaturaDono\(leadId\)/);
});
