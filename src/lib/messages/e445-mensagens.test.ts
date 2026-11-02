/*
  E445 (Relay 57, itens 1, 3 e 4 — Pista B): mensagens. A regra "contato nunca é liberado" continua.
  1. contact-guard: TODO link externo mascarado (http/https/www/domínio comum), exceto vivanomads.com.br.
  3. Ofensas: lista versionada; aviso antes de enviar; enviada mesmo assim → fila do admin; 3 registros → aviso ao admin.
  4. Leitura: lido_em por destinatário; "visto"; não lidas por conversa e total (alimenta o sino como urgente).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guardContactInfo, linkDaViva, MASK_LINK } from "./contact-guard.ts";
import { AVISO_OFENSA, LIMITE_AVISO_ADMIN, normalizarParaOfensa, termoOfensivo } from "./ofensas.ts";
import { TERMOS_OFENSIVOS, VERSAO_LISTA_OFENSAS } from "../../config/ofensas.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const g = (t: string) => guardContactInfo(t).text;

test("1. link do Airbnb (com e sem www, com https) é mascarado", () => {
  for (const t of ["https://www.airbnb.com.br/rooms/12345678", "www.airbnb.com/rooms/1", "airbnb.com/rooms/123", "http://airbnb.com"]) {
    assert.equal(g(`veja ${t} aqui`), `veja ${MASK_LINK} aqui`, t);
    assert.equal(guardContactInfo(t).masked, true, t);
  }
});

test("1. encurtadores e domínio sem www", () => {
  for (const t of ["bit.ly/abc123", "goo.gl/x", "t.co/y", "cutt.ly/z", "is.gd/q", "tinyurl.com/w", "meusite.net.br/x", "booking.com", "minhacasa.app"]) {
    assert.equal(g(t), MASK_LINK, t);
  }
});

test("1. o site da Viva passa (com e sem https, subdomínio, pontuação no fim)", () => {
  for (const t of ["https://vivanomads.com.br/imoveis/abc", "vivanomads.com.br/ajuda", "www.vivanomads.com.br", "https://app.vivanomads.com.br/x"]) assert.equal(g(t), t, t);
  assert.equal(g("Leia vivanomads.com.br/seguranca."), "Leia vivanomads.com.br/seguranca.");
  assert.equal(linkDaViva("https://vivanomads.com.br.evil.com/x"), false, "domínio que só começa igual não passa");
  assert.equal(g("https://vivanomads.com.br.evil.com/x"), MASK_LINK);
});

test("1. sem falso positivo: valores, horários, fim de frase colado, nomes de arquivo", () => {
  for (const t of ["R$ 3.200 por mês, 2.5 km", "Chego às 15h. Até amanhã.Obrigado", "Moro em Uberlândia.Combinado?", "a foto.png está anexada", "Sr. João e Dra. Ana"]) {
    assert.equal(g(t), t, t);
  }
  // As regras antigas seguem iguais (contato nunca é liberado).
  assert.match(g("me chama wa.me/5534999999999"), /\[contato protegido\]/);
  assert.match(g("meu e-mail ana@gmail.com"), /\[contato protegido\]/);
  assert.match(g("instagram.com/fulano"), /\[contato protegido\]/);
  assert.match(g("liga 34 99999-9999"), /\[contato protegido\]/);
});

test("3. ofensas: lista versionada; detecta xingamento grave e ódio, por palavra inteira e sem acento", () => {
  assert.ok(VERSAO_LISTA_OFENSAS >= 1 && TERMOS_OFENSIVOS.length > 5);
  for (const t of TERMOS_OFENSIVOS) assert.equal(t, normalizarParaOfensa(t), `termo fora do formato normalizado: ${t}`);
  assert.equal(termoOfensivo("Seu FILHO DA PUTA!!"), "filho da puta");
  assert.equal(termoOfensivo("vou te matarrr"), "vou te matar");
  assert.equal(termoOfensivo("seu desgraçado"), "desgracado");
  assert.match(AVISO_OFENSA, /a equipe será avisada/);
  assert.equal(LIMITE_AVISO_ADMIN, 3);
});

test("3. falso positivo: conversas normais e palavrão leve passam", () => {
  for (const t of [
    "Oi, tudo bem? Chego amanhã às 15h.",
    "Esse calor está de matar",
    "Ela me mata de rir",
    "Te mato de saudade kkk",
    "Que macaco bonito no zoológico",
    "A cornucópia da sala é linda",
    "porra, esqueci a chave",
    "que merda, o ônibus atrasou",
    "O vizinho é muito educado",
    "Pode deixar a vadiagem do gato pra lá", // "vadia" só por palavra inteira
    "Preto e branco combina com a sala",
  ]) assert.equal(termoOfensivo(t), null, t);
});

test("3. servidor: aviso antes de gravar; enviada mesmo assim → fila; 3º registro avisa a equipe", () => {
  const act = ler("../data/actions.ts");
  const i = act.indexOf("export async function sendMessage(");
  const f = act.slice(i, act.indexOf("\n}\n", i));
  assert.match(f, /if \(ofensa && !input\.enviarMesmoAssim\) return \{ ok: false, ofensa: true, error: AVISO_OFENSA \};/);
  assert.ok(f.indexOf("if (ofensa && !input.enviarMesmoAssim)") < f.indexOf('.from("messages")'), "o aviso vem antes de gravar");
  assert.match(f, /registrarOfensa\(adm, \{ autorId: user\.id, conversationId, messageId:/);
  const srv = ler("./ofensas-servidor.ts");
  assert.match(srv, /if \(registros !== LIMITE_AVISO_ADMIN\) return \{ registros, equipeAvisada: false \};/);
  assert.doesNotMatch(srv, /body: safeBody|texto da mensagem:/);
  const tela = ler("../../app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  // Sem window.confirm (guarda do QA): aviso na tela com "Revisar" e "Enviar mesmo assim".
  assert.doesNotMatch(tela, /window\.confirm/);
  assert.match(tela, /data-testid="aviso-ofensa"/);
  assert.match(tela, /sendMessage\(\{ \.\.\.envio, enviarMesmoAssim: true \}\)/);
});

test("4. leitura: abrir a conversa marca lido; 'visto' e não lidas vêm da coluna; total urgente", () => {
  const aberta = ler("../data/conversa-aberta-actions.ts");
  assert.match(aberta, /update\(\{ lido_em: new Date\(\)\.toISOString\(\) \}\)\.eq\("conversation_id", conversationId\)\.eq\("receiver_id", user\.id\)\.is\("lido_em", null\)/);
  assert.match(aberta, /rpc\("mensagens_nao_lidas"\)/);
  assert.match(aberta, /prioridade: "urgente"/);
  const msgs = ler("../data/messages.ts");
  assert.match(msgs, /\.\.\.\(mine && m\.lido_em \? \{ visto: true \} : \{\}\)/);
  assert.match(msgs, /if \(!mine && m\.lido_em === null\) conv\.naoLidas = \(conv\.naoLidas \?\? 0\) \+ 1;/);
  // Antes da 0287 (sem a coluna), a lista não some.
  assert.match(msgs, /error\.code === "42703"/);
});

test("migração 0287: links no gatilho do banco, só o destinatário marca lido_em, fila só para admin", () => {
  const mig = ler("../../../supabase/migrations/0287_mensagens_protecoes_leitura.sql");
  const apl = ler("../../../supabase/producao/aplicar-0287.sql");
  const rb = ler("../../../supabase/producao/rollback/0287_rollback.sql");
  for (const sql of [mig, apl]) {
    assert.match(sql, /kl constant text := '🔒 \[link protegido\]';/);
    assert.match(sql, /vivanomads\\\.com\\\.br/);
    assert.match(sql, /revoke update on public\.messages from anon, authenticated;/);
    assert.match(sql, /grant update \(lido_em\) on public\.messages to authenticated;/);
    assert.match(sql, /using \(receiver_id = auth\.uid\(\)\)/);
    assert.match(sql, /create table if not exists public\.moderacao_ofensas/);
    assert.match(sql, /using \(public\.is_admin\(\)\)/);
  }
  assert.match(apl, /^begin;/m);
  assert.match(apl, /'0287_mensagens_protecoes_leitura'/);
  assert.match(rb, /drop table if exists public\.moderacao_ofensas;/);
  assert.match(rb, /create or replace function public\.mask_contact/);
});
