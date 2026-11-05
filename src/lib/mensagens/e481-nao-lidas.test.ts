/*
  E481 (Pista B: contagem, ordenação e destaque) — gestão de não lidas quebrada na prática:
   - o sino NÃO baixava ao ler a conversa: a tela marcava lidas no servidor, mas não avisava o sino, que só relia no
     ciclo de 1 minuto; e os avisos de "mensagem nova" gravados antes do E533 (04/11) não têm a conversa (ref_id null:
     os 5 de produção) — abrir a conversa não os achava;
   - a lista de Mensagens não ordenava por atividade (contrato, candidatura e depois a ordem da 1ª mensagem): a
     conversa nova do proprietário ficou no fim de uma lista de 22;
   - as não lidas não apareciam (a contagem por conversa existia — naoLidas — mas a lista não usava).
  Correção: ordem por atividade recente (a última mensagem), não lidas em destaque com a contagem, e abrir a conversa
  zera a dela na tela e avisa o sino na hora (EVENTO_CONTADORES); os avisos antigos sem conversa também saem.
  Roda: node --test src/lib/mensagens/e481-nao-lidas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ordenarPorAtividade, ultimaAtividade } from "./ordem.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const conv = (id: string, ...em: string[]) => ({ id, messages: em.map((e, i) => ({ id: `${id}${i}`, enviadaEm: e })) });

test("ordem: a conversa com a mensagem mais recente primeiro; sem mensagem vai para o fim, na ordem de antes", () => {
  const lista = [conv("contrato"), conv("velha", "2026-10-01T10:00:00Z"), conv("nova", "2026-10-02T10:00:00Z", "2026-11-04T23:00:00Z"), conv("media", "2026-11-01T10:00:00Z"), conv("outra-vazia")];
  assert.deepEqual(ordenarPorAtividade(lista).map((c) => c.id), ["nova", "media", "velha", "contrato", "outra-vazia"]);
  assert.equal(ultimaAtividade(conv("x")), null);
  assert.equal(ultimaAtividade(conv("x", "2026-10-01T10:00:00Z", "2026-10-03T10:00:00Z")), "2026-10-03T10:00:00Z");
});

test("servidor: a lista sai ordenada; abrir a conversa marca também os avisos antigos sem conversa", () => {
  const m = ler("lib/data/messages.ts");
  assert.match(m, /return ordenarPorAtividade\(conversas\);/);
  const a = ler("lib/data/conversa-aberta-actions.ts");
  assert.match(a, /\.eq\("evento", "new_message"\)\.is\("ref_id", null\)\.lt\("criado_em", AVISO_COM_CONVERSA_DESDE\)/);
});

test("tela: abrir zera as não lidas da conversa e avisa o sino na hora; a lista destaca as não lidas", () => {
  const t = ler("app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(t, /marcarConversaAberta\(conversaAbertaId\)\s*\.then\(\(\) => \{/);
  assert.match(t, /window\.dispatchEvent\(new Event\(EVENTO_CONTADORES\)\)/);
  assert.match(t, /setConversations\(\(cs\) => cs\.map\(\(c\) => \(c\.id === conversaAbertaId && c\.naoLidas \? \{ \.\.\.c, naoLidas: 0 \} : c\)\)\)/);
  assert.match(t, /data-nao-lidas=\{c\.naoLidas \?\? 0\}/);
  assert.match(t, /data-testid="mensagens-nao-lidas"/);
});
