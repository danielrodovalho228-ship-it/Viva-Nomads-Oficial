/*
  E703: canal sem o dado necessário nasce desligado e indisponível, com o convite a cadastrar o número. "Mensagens no
  WhatsApp: Ligado" numa conta sem celular prometia um aviso que nunca poderia chegar.
  Roda: node --test src/lib/conta/e703-whatsapp-sem-celular.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CANAIS_AVISO, CONVITE_CELULAR_WHATSAPP, canaisComDado, canaisPadrao } from "./tela-notificacoes.ts";

test("sem celular cadastrado, o WhatsApp sai desligado mesmo que a preferência gravada diga 'ligado'", () => {
  const c = canaisComDado(canaisPadrao(), { temCelular: false });
  assert.deepEqual(c, { email: true, push: true, whatsapp: false });
});

test("com celular, a preferência gravada vale (ligado ou desligado); os outros canais não mudam", () => {
  assert.equal(canaisComDado({ email: true, push: false, whatsapp: true }, { temCelular: true }).whatsapp, true);
  assert.equal(canaisComDado({ email: true, push: false, whatsapp: false }, { temCelular: true }).whatsapp, false);
  assert.equal(canaisComDado({ email: false, push: false, whatsapp: true }, { temCelular: false }).email, false);
});

test("o convite fala claro e leva ao perfil", () => {
  assert.match(CONVITE_CELULAR_WHATSAPP.texto, /Cadastre o seu celular/);
  assert.equal(CONVITE_CELULAR_WHATSAPP.href, "/dashboard/conta/perfil");
  assert.doesNotMatch(JSON.stringify(CANAIS_AVISO), /via WhatsApp/, "linguagem clara: 'no WhatsApp', não 'via WhatsApp'");
});

test("o servidor lê o celular, entrega o canal já desligado e nunca grava 'ligado' sem celular", () => {
  const acao = readFileSync(new URL("../data/canais-actions.ts", import.meta.url), "utf8");
  assert.match(acao, /select\("notif_email, notif_whatsapp, phone"\)/);
  assert.match(acao, /canaisComDado\(/);
  assert.match(acao, /notif_whatsapp: c\.whatsapp && temCelular/);
});

test("a tela desliga o interruptor do WhatsApp sem celular e mostra o convite", () => {
  const tela = readFileSync(new URL("../../components/account/tela-notificacoes.tsx", import.meta.url), "utf8");
  assert.match(tela, /disabled=\{c\.canal === "whatsapp" && !temCelular\}/);
  assert.match(tela, /data-testid="notif-whatsapp-convite"/);
});
