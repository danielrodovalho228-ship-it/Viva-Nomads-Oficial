/*
  E664 — Canal de emergência no dia da chegada (aprovado pelo Daniel). Botão "Falar com o proprietário agora" na conversa
  da plataforma, visível só no dia da entrada, para o morador de contrato ativo assinado pelas duas partes. Dispara aviso
  urgente (push + sino + e-mail) ao proprietário, com a Viva como intermediária: NENHUM contato é mostrado nem trocado
  (regra do E444/E445 intacta). Limite de acionamentos para não virar spam.
  Roda: node --test src/lib/estadia/emergencia-chegada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ESPERA_ENTRE_ACIONAMENTOS_MIN,
  MSG_EMERGENCIA_NA_CONVERSA,
  ROTULO_BOTAO_EMERGENCIA,
  TEXTO_EMERGENCIA_ENVIADA,
  emergenciaDisponivel,
} from "./emergencia-chegada.ts";

const base = { souMorador: true, status: "ativo", assinadoPelasDuas: true, entrada: "2027-01-10", hoje: "2027-01-10" };

test("visível só no dia da entrada, para o morador, em contrato ativo assinado pelas duas partes", () => {
  assert.equal(emergenciaDisponivel(base), true);
  assert.equal(emergenciaDisponivel({ ...base, hoje: "2027-01-09" }), false, "véspera: não");
  assert.equal(emergenciaDisponivel({ ...base, hoje: "2027-01-11" }), false, "dia seguinte: não");
  assert.equal(emergenciaDisponivel({ ...base, souMorador: false }), false, "o dono não vê o botão");
  assert.equal(emergenciaDisponivel({ ...base, assinadoPelasDuas: false }), false);
  assert.equal(emergenciaDisponivel({ ...base, status: "encerrado" }), false);
  assert.equal(emergenciaDisponivel({ ...base, entrada: "" }), false);
});

test("remarcou por aditivo: vale a entrada nova, não a antiga", () => {
  assert.equal(emergenciaDisponivel({ ...base, entrada: "2027-01-24", hoje: "2027-01-10" }), false);
  assert.equal(emergenciaDisponivel({ ...base, entrada: "2027-01-24", hoje: "2027-01-24" }), true);
});

test("a espera entre acionamentos é de 10 minutos", () => {
  assert.equal(ESPERA_ENTRE_ACIONAMENTOS_MIN, 10);
});

test("textos: Viva intermediária, nenhum contato mostrado ou trocado", () => {
  assert.equal(ROTULO_BOTAO_EMERGENCIA, "Falar com o proprietário agora");
  for (const t of [TEXTO_EMERGENCIA_ENVIADA, MSG_EMERGENCIA_NA_CONVERSA]) {
    assert.doesNotMatch(t, /@|\d{4,}|whats|telefone:|celular:/i, "sem contato");
  }
  assert.match(TEXTO_EMERGENCIA_ENVIADA, /Viva/);
  assert.match(TEXTO_EMERGENCIA_ENVIADA, /por aqui|nesta conversa/i, "a resposta vem pela plataforma");
  assert.match(MSG_EMERGENCIA_NA_CONVERSA, /urgente/i);
});

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("servidor: confere morador, contrato ativo/assinado e dia da entrada ANTES de avisar; limite; sem contato", () => {
  const acao = ler("../data/emergencia-chegada-actions.ts");
  assert.match(acao, /^"use server";/);
  assert.match(acao, /\.eq\("tenant_id", user\.id\)/, "só o morador do contrato");
  assert.match(acao, /emergenciaDisponivel\(/);
  assert.match(acao, /dentroDoLimite\(`emergencia-chegada:\$\{contratoId\}`/);
  assert.match(acao, /event: "emergencia_chegada"/);
  assert.match(acao, /MSG_EMERGENCIA_NA_CONVERSA/);
  assert.doesNotMatch(acao, /plantao|phone|telefone/i, "nenhum contato lido nem enviado");
});

test("evento: segurança, sempre chega (sem interruptor), push + sino + e-mail, só o proprietário", () => {
  const m = ler("../../config/matriz-notificacoes.ts");
  assert.match(m, /emergencia_chegada: \{ categoria: "seguranca", papeis: \["proprietario"\], canais: TODOS_OS_CANAIS \}/);
  assert.match(ler("../notifications/avisos.ts"), /"emergencia_chegada",/, "aviso crítico no sino");
});

test("tela: o botão só aparece quando a conversa traz a emergência do dia", () => {
  const tela = ler("../../app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(tela, /active\.emergenciaChegadaContratoId/);
  assert.match(tela, /<EmergenciaChegada key=/);
  assert.match(ler("../../components/estadia/emergencia-chegada.tsx"), /data-testid="emergencia-chegada"/);
  const dados = ler("../data/messages.ts");
  assert.match(dados, /emergenciaDisponivel\(/);
});
