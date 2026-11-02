/*
  E438 (Relay 48 + Relay 50): e-mail de UM imóvel traz a capa real do anúncio, clicável para a página dele; e-mail de UM
  parceiro traz a foto real do parceiro, clicável; imóvel + parceiro: imóvel em destaque e o parceiro junto aos dados dele;
  sem foto, o banner genérico. Texto puro: nem imagem nem URL de imagem (E434), só o link da página com rótulo.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { montarNotificacao } from "./montar-email.ts";
import { blocoParceiroHtml, heroDoDestaque, imagemDoParceiroEmail, linhasTextoDoDestaque, type DestaqueEmail } from "./destaque-email.ts";

const SITE = "https://vivanomads.com.br";
const CAPA = "https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/7216d0e9-6246-482a-a1de-524fd5231dc2/bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp";
const ID = "11111111-1111-1111-1111-111111111111";
const AVATAR = "22222222-2222-2222-2222-222222222222/avatar-0123456789abcdef.webp";
const imovel = { id: ID, titulo: "Apto Santa Mônica", fotoCapa: CAPA, publicado: true };
const parceiro = { slug: "limpeza-da-ana", nome: "Limpeza da Ana", avatarPath: AVATAR, publicado: true };
const montar = (destaque?: DestaqueEmail) => montarNotificacao({ siteUrl: SITE, event: "visita_confirmada", nomeHtml: "Ana", nomeTexto: "Ana", destaque });

test("imóvel: a capa real do anúncio no topo, clicável para a página do anúncio", () => {
  const m = montar({ imovel });
  const capa = `${SITE}/api/email/foto?p=7216d0e9-6246-482a-a1de-524fd5231dc2/bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp`;
  assert.ok(m.html.includes(`<a href="${SITE}/imoveis/${ID}"><img src="${capa}"`), "capa clicável");
  assert.doesNotMatch(m.html, /\/media\/email\//, "sem o banner genérico");
  assert.equal(m.imagem, "capa-do-anuncio");
});

test("parceiro: a foto real do parceiro no topo, clicável para a página dele", () => {
  const m = montar({ parceiro });
  assert.ok(m.html.includes(`<a href="${SITE}/parceiros/limpeza-da-ana"><img src="${SITE}/api/email/foto?pc=${AVATAR}"`));
  assert.equal(m.imagem, "foto-do-parceiro");
});

test("imóvel + parceiro: o imóvel em destaque e o parceiro junto aos dados dele", () => {
  const m = montar({ imovel, parceiro });
  const topo = m.html.indexOf(`<a href="${SITE}/imoveis/${ID}"><img`);
  const bloco = m.html.indexOf("data-parceiro-email");
  assert.ok(topo > 0 && bloco > topo, "capa no topo, parceiro depois");
  assert.ok(heroDoDestaque(SITE, { imovel, parceiro })?.href?.endsWith(`/imoveis/${ID}`));
  assert.match(blocoParceiroHtml(SITE, { imovel, parceiro }), /href="https:\/\/vivanomads\.com\.br\/parceiros\/limpeza-da-ana"/);
  // O bloco do parceiro tem link, mas o botão do e-mail continua.
  assert.ok(m.botao);
});

test("sem foto (ou página fora do ar): banner genérico, nada quebrado", () => {
  for (const d of [
    { imovel: { ...imovel, fotoCapa: null } },
    { imovel: { ...imovel, publicado: false } },
    { imovel: { ...imovel, fotoCapa: "https://evil.example/x.jpg" } },
    { parceiro: { ...parceiro, avatarPath: null } },
    { parceiro: { ...parceiro, publicado: false } },
    { parceiro: { ...parceiro, slug: "../x" } },
    { parceiro: { ...parceiro, avatarPath: "../outro/arquivo.webp" } },
    undefined,
  ] as DestaqueEmail[]) {
    const m = montar(d);
    assert.match(m.html, /\/media\/email\/[a-z-]+\.jpg/, JSON.stringify(d));
    assert.match(m.imagem, /\.jpg$/);
    assert.doesNotMatch(m.html, /data-parceiro-email/);
  }
  // Imóvel sem foto + parceiro: o parceiro não toma o topo (o e-mail é do imóvel).
  assert.equal(heroDoDestaque(SITE, { imovel: { ...imovel, fotoCapa: null }, parceiro }), null);
  assert.equal(imagemDoParceiroEmail(SITE, "x/../../y.webp"), null);
});

test("texto puro: nenhuma URL de imagem; só o link da página, com rótulo", () => {
  const m = montar({ imovel, parceiro });
  assert.doesNotMatch(m.text, /api\/email\/foto|supabase|\.webp|\.jpg|<img/);
  assert.match(m.text, new RegExp(`Ver o anúncio: ${SITE}/imoveis/${ID}`));
  assert.match(m.text, /Ver a página do parceiro: https:\/\/vivanomads\.com\.br\/parceiros\/limpeza-da-ana/);
  assert.equal(linhasTextoDoDestaque(SITE, { imovel: { ...imovel, fotoCapa: null } }), "");
});

test("servidor: notify lê o destaque (best-effort) e a rota da foto só aceita os dois formatos nossos", () => {
  const idx = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(idx, /imovelId\?: string \| null;/);
  assert.match(idx, /parceiroId\?: string \| null;/);
  assert.match(idx, /const destaque = interno \? null : await destaqueDoEmail\(params\.imovelId, params\.parceiroId\)\.catch\(\(\) => null\);/);
  const rota = readFileSync(new URL("../../app/api/email/foto/route.ts", import.meta.url), "utf8");
  assert.match(rota, /CAMINHO_FOTO_EMAIL_RE\.test\(p\) \? `property-photos\/\$\{p\}` : CAMINHO_PARCEIRO_EMAIL_RE\.test\(pc\) \? `parceiros\/\$\{pc\}` : null/);
});

test("chamadores: os e-mails de imóvel e de parceiro passam o id (amostra das famílias principais)", () => {
  const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
  for (const [arquivo, re] of [
    ["../data/propostas-actions.ts", /imovelId:/],
    ["../visitas/avisos-servidor.ts", /imovelId:/],
    ["../data/estadia-actions.ts", /imovelId,\n/],
    ["../parceiros/pedido-servidor.ts", /imovelId: ped\.imovelId, parceiroId: ped\.parceiroId/],
    ["../automacao/acoes.ts", /parceiroId: v\.parceiro_id/],
    ["../parceiros/admin-actions.ts", /parceiroId: p\.id/],
    ["../../app/api/cron/automacoes/route.ts", /imovelId:/],
  ] as const) assert.match(ler(arquivo), re, arquivo);
});
