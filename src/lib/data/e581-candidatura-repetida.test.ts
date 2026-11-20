/*
  E581 (GRAVE) — a candidatura gravava a estadia errada: 120 dias em vez dos dias escolhidos. Prova do QA (04/11):
  23:31 a moradora enviou a candidatura com saída 10/05/2027 (120 dias); 00:41 enviou de novo com 22/02/2027 (43 dias).
  O lead é único por (imóvel, morador): no 2º envio o servidor achava o lead e NÃO atualizava nada, mas mandava de novo
  os dois e-mails, montados com o período gravado (120 dias) — e a proposta derivava dali.
  Correção: candidatura repetida com o lead ainda sem resposta ("new") ATUALIZA o período (entrada, saída, motivo e
  pessoas, com a mesma validação do insert) e registra a mensagem na conversa; os e-mails leem o lead já atualizado.
  Candidatura já respondida (aceita/recusada) não muda e não manda e-mail: a pessoa é orientada a falar pelo chat.
  Falha ao atualizar: erro visível, nada de e-mail com o período antigo.
  Roda: node --test src/lib/data/e581-candidatura-repetida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposDaCandidatura, MSG_CANDIDATURA_JA_RESPONDIDA } from "../candidatura/campos.ts";

const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const fn = acoes.slice(acoes.indexOf("export async function requestLead"), acoes.indexOf("/** Envia uma mensagem no chat"));

test("camposDaCandidatura: a saída só entra com entrada válida e depois dela; sem saída válida, fim fica null", () => {
  const ok = { inicioOk: true, inicio: "2027-01-10" };
  assert.deepEqual(camposDaCandidatura({ ...ok, fim: "2027-02-22", motivo: "trabalho_remoto", ocupantes: 1 }), {
    inicio_desejado: "2027-01-10",
    fim_desejado: "2027-02-22",
    motivo_estadia: "trabalho_remoto",
    qtd_ocupantes: 1,
  });
  assert.equal(camposDaCandidatura({ ...ok, fim: "2027-01-05", motivo: null, ocupantes: null }).fim_desejado, null, "saída antes da entrada");
  assert.equal(camposDaCandidatura({ ...ok, fim: "", motivo: null, ocupantes: null }).fim_desejado, null);
  const semInicio = camposDaCandidatura({ inicioOk: false, inicio: "x", fim: "2027-02-22", motivo: null, ocupantes: null });
  assert.equal(semInicio.inicio_desejado, null);
  assert.equal(semInicio.fim_desejado, null, "sem entrada válida não há saída (check da 0258)");
});

test("requestLead: lead existente + candidatura + status new → atualiza o período (admin, filtrado ao morador e a 'new')", () => {
  assert.match(fn, /\.select\("id, status"\)\s*\.eq\("property_id", propertyId\)\s*\.eq\("tenant_id", user\.id\)/);
  assert.match(fn, /if \(existing && kind === "candidatura"\) \{/);
  assert.match(fn, /if \(existing\.status !== "new"\) return \{ ok: false, error: MSG_CANDIDATURA_JA_RESPONDIDA \};/);
  assert.match(fn, /\.update\(\{ \.\.\.campos, reenviada_em: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\("id", existing\.id\)\s*\.eq\("tenant_id", user\.id\)\s*\.eq\("status", "new"\)/);
  assert.match(fn, /if \(erroAtualiza \|\| !atualizado\?\.length\) return \{ ok: false, error: MSG_CANDIDATURA_NAO_ATUALIZOU \};/);
  // A nova escolha também vai para a conversa (o dono vê o período novo).
  assert.match(fn, /await abrirConversa\(\);/);
});

test("o insert e a atualização usam os MESMOS campos validados", () => {
  assert.match(fn, /const campos = camposDaCandidatura\(\{/);
  assert.match(fn, /\.insert\(\{\s*property_id: propertyId,\s*owner_id: ownerId,\s*tenant_id: user\.id,\s*status: "new",\s*\.\.\.camposDoInsert,/);
  assert.match(MSG_CANDIDATURA_JA_RESPONDIDA, /chat/);
});

test("a tela mostra a razão do servidor (ex.: candidatura já respondida), não só o erro genérico de rede", () => {
  const tela = readFileSync(new URL("../../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(tela, /setLeadErro\(r\?\.error \?\? "Não foi possível enviar agora\. Verifique a conexão e tente novamente\."\);/);
});
