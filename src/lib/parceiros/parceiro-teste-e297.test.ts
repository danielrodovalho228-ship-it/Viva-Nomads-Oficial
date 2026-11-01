/*
  E297 — parceiro de teste segue a regra do anúncio de teste (E93): fora da busca e das listagens para o público,
  noindex, faixa na página e no cartão, e pedido de orçamento só da equipe (conta de teste ou admin).
  Roda: node --test src/lib/parceiros/parceiro-teste-e297.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FAIXA_PARCEIRO_TESTE_DONO,
  FAIXA_PARCEIRO_TESTE_EQUIPE,
  FAIXA_PARCEIRO_TESTE_VISITANTE,
  PEDIDO_PARCEIRO_TESTE_RECUSADO,
  filtrarParceiros,
  modoParceiroTeste,
  type ParceiroNaBusca,
} from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ninguem = { dono: false, admin: false, teste: false };

test("modoParceiroTeste: parceiro de verdade não muda nada; de teste, dono × equipe × visitante (E339)", () => {
  assert.equal(modoParceiroTeste(false, ninguem), null);
  assert.equal(modoParceiroTeste(false, { dono: true, admin: true, teste: true }), null);
  assert.equal(modoParceiroTeste(true, ninguem), "visitante");
  assert.equal(modoParceiroTeste(true, { ...ninguem, dono: true }), "dono");
  assert.equal(modoParceiroTeste(true, { dono: true, admin: true, teste: true }), "dono");
  assert.equal(modoParceiroTeste(true, { ...ninguem, admin: true }), "equipe");
  assert.equal(modoParceiroTeste(true, { ...ninguem, teste: true }), "equipe");
});

test("E339: a faixa diz a verdade conforme quem vê (conta de teste o vê; o dono lê que o público não o vê)", () => {
  assert.equal(FAIXA_PARCEIRO_TESTE_EQUIPE, "Parceiro de teste: visível só para contas de teste");
  assert.equal(FAIXA_PARCEIRO_TESTE_DONO, "Seu perfil de teste não aparece para o público");
  assert.equal(FAIXA_PARCEIRO_TESTE_VISITANTE, "Parceiro de teste da equipe Viva — não é um prestador disponível");
  assert.match(PEDIDO_PARCEIRO_TESTE_RECUSADO, /parceiro de teste/);
});

test("busca pública: os três parceiros de teste de produção somem para o visitante e aparecem para a equipe", () => {
  const base = { categorias: ["limpeza"], cidades: ["Uberlândia"], notaMedia: null, avaliacoesQtd: 0, publicadoEm: "2026-10-30T00:00:00Z", status: "publicado" };
  const lista: ParceiroNaBusca[] = [
    { ...base, slug: "teste-qa-limpeza-e213", teste: true },
    { ...base, slug: "teste-qa-limpeza-d5", teste: true },
    { ...base, slug: "paulo-fotos-teste-qa", categorias: ["fotografia"], teste: true },
    { ...base, slug: "limpeza-de-verdade", teste: false },
  ];
  assert.deepEqual(filtrarParceiros(lista, {}).map((p) => p.slug), ["limpeza-de-verdade"]);
  assert.deepEqual(filtrarParceiros(lista, { categoria: "limpeza", cidade: "Uberlândia" }).map((p) => p.slug), ["limpeza-de-verdade"]);
  assert.equal(filtrarParceiros(lista, { verTeste: true }).length, 4);
});

test("a busca só liga verTeste para conta de teste ou admin (lido no servidor), nunca pela URL", () => {
  const src = ler("src/lib/data/parceiros-publico.ts");
  assert.match(src, /verTeste: await veParceirosDeTeste\(\)/);
  assert.match(src, /return q\.teste \|\| q\.admin;/);
  assert.match(src, /select\("is_teste, role"\)\.eq\("id", user\.id\)/);
  assert.doesNotMatch(src.slice(src.indexOf("export async function buscarParceiros")), /f\.verTeste|searchParams/);
});

test("página do parceiro: noindex do teste, faixa por modo e pedido desativado para o visitante", () => {
  const pagina = ler("src/app/(public)/parceiros/[slug]/page.tsx");
  assert.match(pagina, /robots: p\.teste \? \{ index: false, follow: false \} : undefined/);
  assert.match(pagina, /const modoTeste = await modoDaPaginaDoParceiro\(p\);/);
  assert.match(pagina, /data-testid="faixa-parceiro-teste"/);
  assert.match(pagina, /modoTeste === "visitante" \? FAIXA_PARCEIRO_TESTE_VISITANTE : modoTeste === "dono" \? FAIXA_PARCEIRO_TESTE_DONO : FAIXA_PARCEIRO_TESTE_EQUIPE/);
  // O visitante não recebe a folha de pedido (nem botão): só o aviso; a folha fica no outro ramo.
  const visitante = pagina.indexOf('modoTeste === "visitante" ? (');
  const folha = pagina.indexOf("<SolicitarOrcamento");
  assert.ok(visitante > 0 && folha > visitante, "a folha fica no ramo de quem não é visitante");
  assert.match(pagina.slice(visitante, folha), /data-testid="parceiro-pedido-teste"[\s\S]*Este perfil não recebe pedidos\./);
  const dados = ler("src/lib/data/parceiros-publico.ts");
  assert.match(dados, /if \(!p\.teste\) return null;/, "parceiro de verdade: nenhuma leitura extra");
  assert.match(dados, /select\("user_id"\)\.eq\("id", p\.id\)/, "o próprio parceiro é da equipe");
});

test("cartão da busca: parceiro de teste (só a equipe o recebe) leva a faixa", () => {
  const cartao = ler("src/components/parceiros/cartao-parceiro.tsx");
  assert.match(cartao, /\{p\.teste && \(/);
  assert.match(cartao, /data-testid="cartao-parceiro-teste"/);
  assert.match(cartao, /\{FAIXA_PARCEIRO_TESTE_EQUIPE\}/);
});

test("servidor: pedido a parceiro de conta de teste só da equipe, antes de gravar", () => {
  const acoes = ler("src/lib/parceiros/pedido-actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function solicitarOrcamento"));
  const guarda = fn.indexOf("podePedirAoParceiro(admin, parceiro.user_id, userId)");
  assert.ok(guarda > 0 && guarda < fn.indexOf('.from("parceiro_pedidos")'), "a recusa vem antes de qualquer gravação");
  const helper = acoes.slice(acoes.indexOf("async function podePedirAoParceiro"), acoes.indexOf("export async function solicitarOrcamento"));
  assert.match(helper, /if \(dono\?\.is_teste !== true\) return true;/);
  assert.match(helper, /cliente\?\.is_teste === true \|\| cliente\?\.role === "admin"/);
  assert.match(helper, /if \(error \|\| !data\) return false;/);
});

test("E339: o painel do próprio parceiro de teste explica que o público não vê o perfil", () => {
  const acoes = ler("src/lib/parceiros/painel-actions.ts");
  assert.match(acoes, /teste: \(perfil as \{ is_teste\?: boolean \} \| null\)\?\.is_teste === true,/);
  const painel = ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
  assert.match(painel, /\{p\.teste && \([\s\S]{0,120}data-testid="parceiro-perfil-teste"[\s\S]{0,40}\{FAIXA_PARCEIRO_TESTE_DONO\}\./);
});
