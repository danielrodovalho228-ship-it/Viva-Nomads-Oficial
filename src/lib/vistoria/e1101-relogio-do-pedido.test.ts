/*
  E1101 (ORDEM-DUET-465) — relógios contraditórios do mesmo pedido: o dono via a proposta viva, com 72 h para aceitar,
  enquanto o avaliador, que JÁ tinha proposto, lia que o prazo de 24 horas para responder tinha passado.
  Regras travadas aqui (uma fonte só para os dois lados, as ações e a rotina):
   1. o relógio de resposta do avaliador PARA quando a proposta é enviada;
   2. as 72 h do dono correm DA PROPOSTA;
   3. de quem é a vez sai de um lugar só: enquanto o dono não aceitar, o pedido não está "aceito" para o avaliador —
      nem no piloto, onde o pedido é de conta de teste (a avaliação de teste do credenciamento, que o admin designa e o
      dono não escolhe, segue sem aceite);
   4. a recusa de uma proposta repetida diz o motivo certo, e o prazo é o que o avaliador declarou (não "24 horas" fixas).
  Roda: node --test src/lib/vistoria/e1101-relogio-do-pedido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  erroAoPropor,
  precisaDoAceiteDoDono,
  relogioDoPedido,
  textoDoPrazoDeAceite,
  textoDoPrazoDeResposta,
} from "./relogio-do-pedido.ts";
import { etapaDoPedido } from "./pedido-avaliador.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-22T15:00:00Z");
const h = (n: number) => new Date(AGORA.getTime() - n * 3_600_000).toISOString();
const base = { status: "designado", resposta: null as string | null | undefined, designadoEm: h(2), propostaEm: null as string | null, propostaAceitaEm: null as string | null, precisaDoAceite: true };

test("E1101 (1): sem proposta, a vez é do avaliador — pelo prazo que ELE declarou (padrão 24 h)", () => {
  assert.deepEqual(relogioDoPedido(base, AGORA), { vez: "avaliador", ate: new Date(Date.parse(h(2)) + 24 * 3_600_000).toISOString(), vencido: false, horas: 24 });
  assert.deepEqual(relogioDoPedido({ ...base, prazoRespostaHoras: 12 }, AGORA), { vez: "avaliador", ate: new Date(Date.parse(h(2)) + 12 * 3_600_000).toISOString(), vencido: false, horas: 12 });
  assert.equal(relogioDoPedido({ ...base, designadoEm: h(30) }, AGORA)?.vencido, true);
  assert.equal(relogioDoPedido({ ...base, designadoEm: h(30), prazoRespostaHoras: 48 }, AGORA)?.vencido, false, "quem declarou 48 h ainda está no prazo às 30 h");
});

test("E1101 (1 e 2): enviada a proposta, o relógio de resposta PARA e correm as 72 h do dono, contadas da proposta", () => {
  // O caso da ronda das 09:00: escolhido há 30 h, proposta há 1 h. Não há prazo de resposta vencido; há 71 h para o dono.
  const r = relogioDoPedido({ ...base, resposta: "aceita", designadoEm: h(30), propostaEm: h(1) }, AGORA);
  assert.deepEqual(r, { vez: "dono", ate: new Date(Date.parse(h(1)) + 72 * 3_600_000).toISOString(), vencido: false, horas: 72 });
  assert.equal(relogioDoPedido({ ...base, resposta: "aceita", propostaEm: h(73) }, AGORA)?.vencido, true);
  // A proposta gravada manda mesmo se a resposta lida vier vazia (leitura a meio, dado incoerente): nunca "responda em…".
  assert.equal(relogioDoPedido({ ...base, resposta: null, designadoEm: h(30), propostaEm: h(1) }, AGORA)?.vez, "dono");
  assert.equal(relogioDoPedido({ ...base, resposta: undefined, designadoEm: h(30), propostaEm: h(1) }, AGORA)?.vez, "dono");
});

test("E1101: sem relógio — proposta aceita, resposta já dada sem proposta, designação não lida, fora do 'designado'", () => {
  assert.equal(relogioDoPedido({ ...base, resposta: "aceita", propostaEm: h(5), propostaAceitaEm: h(1) }, AGORA), null);
  assert.equal(relogioDoPedido({ ...base, resposta: "aceita" }, AGORA), null, "já respondeu: não há relógio de resposta");
  assert.equal(relogioDoPedido({ ...base, resposta: "recusada" }, AGORA), null);
  assert.equal(relogioDoPedido({ ...base, resposta: undefined }, AGORA), null, "sem a designação lida não se inventa prazo nem formulário");
  assert.equal(relogioDoPedido({ ...base, status: "agendado", resposta: "aceita", propostaEm: h(5), propostaAceitaEm: h(1) }, AGORA), null);
  // A avaliação de teste do credenciamento não tem aceite do dono: enviada a proposta, não há relógio do dono.
  assert.equal(relogioDoPedido({ ...base, resposta: "aceita", propostaEm: h(1), precisaDoAceite: false }, AGORA), null);
});

test("E1101 (3): só a avaliação de teste do credenciamento dispensa o aceite; o pedido que o dono escolheu precisa, mesmo de conta de teste", () => {
  assert.equal(precisaDoAceiteDoDono({ teste: false, escolhidoEm: h(3) }), true);
  assert.equal(precisaDoAceiteDoDono({ teste: false, escolhidoEm: null }), true);
  assert.equal(precisaDoAceiteDoDono({ teste: true, escolhidoEm: h(3) }), true, "piloto: o dono (conta de teste) escolheu e aceita a proposta");
  assert.equal(precisaDoAceiteDoDono({ teste: true, escolhidoEm: null }), false, "teste do credenciamento: o admin designou");
});

test("E1101 (3): a etapa do avaliador — no piloto, com a proposta enviada e sem o aceite, é 'proposta enviada' (era 'aceito')", () => {
  const p = { status: "designado", resposta: "aceita" as string | null, proposta_aceita_em: null as string | null };
  assert.equal(etapaDoPedido({ ...p, teste: true, escolhido_em: h(3) }), "proposta_enviada");
  assert.equal(etapaDoPedido({ ...p, teste: true, escolhido_em: h(3), proposta_aceita_em: h(1) }), "aceito");
  assert.equal(etapaDoPedido({ ...p, teste: false, escolhido_em: h(3) }), "proposta_enviada");
  // A avaliação de teste do credenciamento segue como era: sem proposta para o dono aceitar.
  assert.equal(etapaDoPedido({ ...p, teste: true, escolhido_em: null }), "aceito");
});

test("E1101 (1 e 2): os textos dos dois relógios", () => {
  assert.equal(textoDoPrazoDeResposta({ vez: "avaliador", ate: new Date(AGORA.getTime() + (23 * 60 + 10) * 60_000).toISOString(), vencido: false, horas: 24 }, AGORA), "Responda em 23 h 10 min");
  assert.equal(textoDoPrazoDeResposta({ vez: "avaliador", ate: h(1), vencido: true, horas: 24 }, AGORA), "Prazo de resposta vencido: o pedido volta ao proprietário, que escolhe de novo.");
  // 22/11 15:00Z − 1 h + 72 h = 25/11 14:00Z = 25/11 11:00 em Brasília.
  assert.equal(textoDoPrazoDeAceite({ vez: "dono", ate: new Date(Date.parse(h(1)) + 72 * 3_600_000).toISOString(), vencido: false, horas: 72 }), "O proprietário tem até 25/11/2026 11:00 (horário de Brasília) para aceitar: 72 horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.");
});

test("E1101 (4): propor de novo — o motivo certo, nunca 'o prazo de 24 horas' para quem já propôs", () => {
  assert.equal(erroAoPropor("aceita", 24), "A proposta deste pedido já foi enviada.");
  assert.equal(erroAoPropor("recusada", 24), "Você recusou este pedido; ele voltou ao proprietário.");
  assert.equal(erroAoPropor("expirada", 24), "O prazo de 24 horas para responder já passou.");
  assert.equal(erroAoPropor("expirada", 12), "O prazo de 12 horas para responder já passou.");
  assert.equal(erroAoPropor("expirada", 1), "O prazo de 1 hora para responder já passou.");
  assert.equal(erroAoPropor(undefined, 24), "Este pedido não está mais com você.");
  assert.equal(erroAoPropor("ausencia", 24), "Este pedido não está mais com você.");
});

test("E1101: uma fonte só — os dois lados, as ações e a rotina leem o relógio e o aceite daqui", () => {
  const lista = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  assert.match(lista, /relogioDoPedido\(/);
  assert.match(lista, /precisaDoAceiteDoDono\(/);
  assert.doesNotMatch(lista, /resposta\.get\(p\.id\) \?\? null/, "designação não lida não vira 'sem resposta' (era o que abria o formulário de proposta)");
  assert.doesNotMatch(lista, /p\.proposta_aceita_em \|\| p\.teste/);
  const detalhe = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx"));
  assert.match(detalhe, /relogioDoPedido\(/);
  assert.match(detalhe, /escolhido_em/);
  const dono = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(dono, /precisaDoAceiteDoDono\(/);
  assert.doesNotMatch(dono, /atual\.proposta_aceita_em \|\| atual\.teste/);
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  assert.match(acoes, /erroAoPropor\(/);
  assert.doesNotMatch(acoes, /"O prazo de 24 horas para responder já passou\."/, "o texto fixo saiu da ação");
  assert.match(acoes, /precisaDoAceiteDoDono\(/);
  assert.doesNotMatch(acoes, /!prop\?\.teste && !prop\?\.proposta_aceita_em/);
  // A rotina: a designação só vence pelo relógio de resposta — com a proposta enviada, ele parou.
  const rotina = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const corpo = rotina.slice(rotina.indexOf("export async function rotinaVistoria("));
  assert.match(corpo.slice(0, 2600), /relogioDoPedido\(/);
});
