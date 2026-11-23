/*
  E1099 (ORDEM-DUET-458, Parceiros, Code 2): a conformidade restante do perfil público do CREDENCIADO com o desenho
  aprovado (docs/mockups-avaliadores/). Parte 1 (sem migração): a caixa "Novo na Viva" no perfil do credenciado, com a
  mesma regra do cartão de escolha e do perfil do piloto (novoNaViva: sem avaliações concluídas). O quadro número /
  avaliações / nota continua (as travas telas-exibicao leem os testids dele).
  Parte 2 ("Sobre", campo novo do avaliador): migração — só depois da palavra do Gerente.
  Roda: node --test src/lib/vistoria/e1099-perfil-credenciado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartaoDoAvaliador, contaDaLinhaDeCredenciamento, novoNaViva, TEXTO_IDENTIDADE_VERIFICADA, TITULO_NOVO_NA_VIVA } from "./vitrine-avaliadores.ts";

const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
const credenciado = pagina.slice(pagina.indexOf("export default async function AvaliadorPage"), pagina.indexOf("async function PerfilPublico"));

test("E1099: a regra do 'Novo na Viva' é a mesma do cartão de escolha (sem avaliações concluídas)", () => {
  assert.equal(novoNaViva(0, null), true);
  assert.equal(novoNaViva(3, 4.8), false);
  // E1138 (ORDEM-DUET-601): as duas metades da regra — sem avaliações concluídas MAS com nota de conduta já não é "novo".
  assert.equal(novoNaViva(0, 4.8), false, "0 avaliações com nota de conduta: não é Novo na Viva");
  assert.equal(novoNaViva(2, null), false, "avaliações concluídas sem nota: não é Novo na Viva");
  assert.equal(TITULO_NOVO_NA_VIVA, "Novo na Viva");
});

test("E1099 (ORDEM-460 §2): 'Novo na Viva' e a linha das avaliações são DOIS ESTADOS da mesma área — nunca os dois", () => {
  assert.match(credenciado, /const novo = novoNaViva\(a\.avaliacoes_feitas, nota\);/);
  const area = credenciado.slice(credenciado.indexOf("{novo ? ("), credenciado.indexOf('data-testid="avaliador-preco"'));
  assert.match(area, /^\{novo \? \(\s*<div[^>]*data-testid="avaliador-novo"/);
  assert.match(area, /\{TITULO_NOVO_NA_VIVA\}[\s\S]*\{TEXTO_NOVO_NA_VIVA\}/);
  // O outro estado (com avaliações): as avaliações feitas e a nota — os testids que telas-exibicao lê.
  const comAvaliacoes = area.slice(area.indexOf(") : ("));
  for (const id of ["avaliador-feitas", "avaliador-nota"]) assert.match(comAvaliacoes, new RegExp(`data-testid="${id}"`));
  assert.doesNotMatch(area.slice(0, area.indexOf(") : (")), /avaliador-feitas|avaliador-nota/);
  // O número de credenciado fica sempre (não é avaliação).
  assert.match(credenciado, /data-testid="avaliador-numero"/);
});

test("E1099 (ORDEM-460 §3): 'Identidade verificada pela Viva' no perfil, da fonte única, só com a identidade confirmada", () => {
  assert.equal(TEXTO_IDENTIDADE_VERIFICADA, "Identidade verificada pela Viva");
  assert.match(credenciado, /const identidadeOk = admin \? await identidadeConfirmadaDoCredenciado\(admin, a\.numero_credenciado\) : false;/);
  assert.match(credenciado, /\{identidadeOk && \(\s*<p[^>]*data-testid="avaliador-identidade"[\s\S]*?\{TEXTO_IDENTIDADE_VERIFICADA\}/);
  assert.doesNotMatch(pagina, /"Identidade verificada pela Viva"/, "o texto não se duplica na página");
  const srv = readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8");
  assert.match(srv, /export async function identidadeConfirmadaDoCredenciado[\s\S]*?\(await estadoIdentidade\(admin, uid\)\)\.estado === "confirmada"/);
});

test("E1099 parte 3 (ORDEM-463 §1): 'Identidade verificada pela Viva' no cartão da LISTAGEM pública — só com a identidade confirmada", () => {
  // O cartão leva o fato; sem ele (perfil do piloto, conta sem leitura), nada.
  const base = { numero: "UDI-001", nome: "Ana", cidade: "Uberlândia", selo: null, avaliacoesFeitas: 0, notaConduta: null, contaTeste: true, fotoUrl: null };
  assert.equal(cartaoDoAvaliador({ ...base, identidadeVerificada: true }).identidadeVerificada, true);
  assert.equal(cartaoDoAvaliador({ ...base, identidadeVerificada: false }).identidadeVerificada, false);
  assert.equal(cartaoDoAvaliador(base).identidadeVerificada, false);
  const srv = readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8");
  assert.match(srv, /identidadeVerificada: uid \? await identidadeConfirmadaDaConta\(admin, uid\) : false,/);
  const cartao = readFileSync("src/components/vistoria/vitrine-avaliadores.tsx", "utf8");
  assert.match(cartao, /\{c\.identidadeVerificada && \(\s*<p[^>]*data-testid="vitrine-identidade"[\s\S]*?\{TEXTO_IDENTIDADE_VERIFICADA\}/);
  assert.doesNotMatch(cartao, /"Identidade verificada pela Viva"/, "o texto não se duplica no cartão");
});

test("E1099 (ORDEM-473 §1): a listagem acha a conta pela MESMA regra do perfil — também no credenciamento criado pelo parceiro", () => {
  // A regra única: a conta do credenciamento; sem ela (credenciamento criado pelo parceiro), a conta do parceiro.
  assert.equal(contaDaLinhaDeCredenciamento({ user_id: "u1", parceiros: { user_id: "p1" } }), "u1");
  assert.equal(contaDaLinhaDeCredenciamento({ user_id: null, parceiros: { user_id: "p1" } }), "p1", "criado pelo parceiro: a conta do parceiro");
  assert.equal(contaDaLinhaDeCredenciamento({ user_id: null, parceiros: null }), null);
  const srv = readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8");
  // A listagem lê o parceiro e resolve a conta pela regra única (nada de só `user_id`).
  assert.match(srv, /from\("avaliadores_credenciamento"\)\.select\("id, numero_credenciado, user_id, parceiros\(user_id\)"\)\.in\("status", \["ativo", "em_teste"\]\)/);
  assert.match(srv, /credsLidos\.map\(\(c\) => \[c\.numero_credenciado, contaDaLinhaDeCredenciamento\(c\)\]\)/);
  // O perfil (contaDoCredenciado: foto e identidade) usa a mesma regra.
  assert.match(srv, /export async function contaDoCredenciado[\s\S]*?return contaDaLinhaDeCredenciamento\(/);
  assert.doesNotMatch(srv, /c\?\.user_id \?\? c\?\.parceiros\?\.user_id/, "a regra não se repete à mão");
});
