/* E682 (refino): completar a E648 parte 1 — prazo do dono para aceitar, silêncio do avaliador volta ao dono, avisos dos dois lados,
   e o bloco de escolha some por completo com VISTORIA_ATIVA desligada. Roda: node --test src/lib/vistoria/e682-completar-e648.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { PRAZO_DONO_ACEITAR_HORAS, propostaVencida } from "./escolha.ts";
import { blocoDoDonoVisivel } from "./telas-exibicao.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const servidor = ler("src/lib/vistoria/servidor.ts");
const rotina = servidor.slice(servidor.indexOf("export async function rotinaVistoria"));

test("o dono tem 72 h (decisão do Daniel, 07/11) para aceitar a proposta; depois a escolha volta ao dono", () => {
  assert.equal(PRAZO_DONO_ACEITAR_HORAS, 72);
  const t0 = "2026-11-07T10:00:00Z";
  assert.equal(propostaVencida(t0, new Date("2026-11-10T09:59:00Z")), false);
  assert.equal(propostaVencida(t0, new Date("2026-11-10T10:00:00Z")), true);
  assert.equal(propostaVencida(null, new Date("2026-12-01T00:00:00Z")), false);
});

test("o cron devolve ao dono (sem rodízio) no silêncio do avaliador e na proposta que o dono não aceitou", () => {
  assert.doesNotMatch(servidor, /passam ao próximo/);
  assert.doesNotMatch(ler("src/lib/vistoria/regras.ts"), /Recusa ou silêncio passam ao próximo da fila/);
  assert.match(rotina, /devolverAoDono\(admin, d\.pedido_id, d\.avaliador_id, "expirada", agora\)/);
  assert.match(rotina, /propostaVencida\(/);
  assert.doesNotMatch(rotina, /proximoAvaliador|designarProximo/);
});

test("o dono é avisado na recusa, no silêncio e quando o prazo dele vence; o texto cobre os três casos", () => {
  assert.match(rotina, /avisar\(admin, [^)]*"vistoria_designado_dono"/);
  const eventos = ler("src/lib/notifications/eventos-email.ts");
  const linha = eventos.slice(eventos.indexOf("vistoria_designado_dono: { subject"), eventos.indexOf("vistoria_designado_dono: { subject") + 700);
  assert.match(linha, /não respondeu no prazo/);
  assert.match(linha, /72 horas/);
});

test("o avaliador é avisado ao ser escolhido (e o texto traz o prazo dele, não um número fixo)", () => {
  assert.match(servidor, /avisar\(admin, a\.userId, "vistoria_designada"/);
  const eventos = ler("src/lib/notifications/eventos-email.ts");
  const linha = eventos.slice(eventos.indexOf("vistoria_designada: { subject"), eventos.indexOf("vistoria_designada: { subject") + 500);
  assert.match(linha, /no prazo que você declarou/);
});

test("com a chave desligada o bloco some por completo: conta real nada, conta de teste só leitura sem lista nem botão de escolha", () => {
  assert.equal(blocoDoDonoVisivel(false, false), null);
  assert.equal(blocoDoDonoVisivel(false, null), null);
  assert.equal(blocoDoDonoVisivel(false, undefined), null);
  assert.equal(blocoDoDonoVisivel(false, true), "so_leitura_teste");
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  const i = bloco.indexOf("if (!visivel) return null;");
  assert.ok(i > 0, "o bloco retorna null antes de qualquer leitura");
  assert.ok(i < bloco.indexOf('.from("vistoria_pedidos")'));
  // a lista de sugeridos só é montada com a chave ligada; sem ela não há avaliador nem botão "Escolher"
  assert.match(bloco, /visivel === "ativa"\) \{\s*try \{\s*const lista = \(await sugeridosDoPedido/);
  // as ações do dono recusam com a chave desligada
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.match(acoes.slice(acoes.indexOf("export async function escolherAvaliador")), /if \(!\(await vistoriaAtiva\(\)\)\) return DESLIGADA/);
});

test("a tela mostra o prazo do dono para aceitar e o prazo declarado do avaliador, e a lista traz 'avaliações feitas'", () => {
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /PRAZO_DONO_ACEITAR_HORAS/);
  assert.match(bloco, /prazo_resposta_horas/);
  assert.match(ler("src/lib/vistoria/escolha.ts"), /avaliações feitas/);
});
