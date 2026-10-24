/*
  A6 — Conta › Notificações (mockup perfil-06): textos dos cartões, regras puras e as travas de envio.
  Roda: node --test src/lib/conta/tela-notificacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CANAIS_AVISO, TIPOS_AVISO, canaisPadrao, categoriasDesligadasDe, normalizarCanais } from "./tela-notificacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("os três tipos e os três canais na ordem do desenho", () => {
  assert.deepEqual(TIPOS_AVISO.map((t) => t.titulo), ["Novas mensagens", "Lembretes da estadia", "Novidades e dicas da Viva"]);
  assert.deepEqual(CANAIS_AVISO.map((c) => c.titulo), ["E-mail", "Notificação no celular (push)", "WhatsApp"]);
});

test("vocabulário: sem check-in, check-out, reserva nem viagens", () => {
  const textos = [...TIPOS_AVISO, ...CANAIS_AVISO].map((t) => `${t.titulo} ${t.texto}`).join(" ");
  assert.doesNotMatch(textos, /check-in|check-out|reserva|viage|acomoda|hósped|temporada/i);
  assert.match(textos, /conferência de entrada e de saída/);
  assert.match(textos, /imóveis mobiliados/);
});

test("sem preferência salva = ligado; só false desliga", () => {
  assert.deepEqual(canaisPadrao(), { email: true, push: true, whatsapp: true });
  assert.deepEqual(normalizarCanais({}), { email: true, push: true, whatsapp: true });
  assert.deepEqual(normalizarCanais({ email: false, push: null, whatsapp: "x" }), { email: false, push: true, whatsapp: true });
});

test("interruptor desligado vira categoria desligada", () => {
  assert.deepEqual(categoriasDesligadasDe({ mensagens: true, lembretes: true, outros: true }), []);
  assert.deepEqual(categoriasDesligadasDe({ mensagens: false, lembretes: true, outros: false }), ["mensagens", "outros"]);
});

test("a tela grava as duas preferências num só 'Salvar preferências' e não liga envio", () => {
  const tela = ler("src/components/account/tela-notificacoes.tsx");
  assert.match(tela, /Salvar preferências/);
  assert.match(tela, /setCategoriasDesligadas\(categoriasDesligadasDe\(tipos\)\)/);
  assert.match(tela, /setCanais\(canais\)/);
  assert.doesNotMatch(tela, /window\.confirm|alert\(/);
  const acoes = ler("src/lib/data/canais-actions.ts");
  // Só grava preferência: nada de envio, número oficial ou chave de SMS.
  assert.doesNotMatch(acoes, /enviar|sendWhats|SMS_ATIVO|fetch\(/i);
  assert.match(acoes, /updateUser\(\{ data: \{ notif_push: c\.push \} \}\)/);
  const pagina = ler("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx");
  assert.match(pagina, /<CascaConta ativo="notificacoes">\s*<TelaNotificacoes \/>/);
});
