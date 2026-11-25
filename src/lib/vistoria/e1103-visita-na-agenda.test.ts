/*
  E1103 (ORDEM-DUET-467) — a visita confirmada de uma avaliação não aparecia na Agenda geral do parceiro: a visita de
  hoje estava na tela do pedido dos dois lados, mas a Agenda (painel do parceiro) só lia os pedidos de serviço. Sintoma
  vizinho: no bloco do dono, a linha "Combinado com o avaliador" sumia depois do agendamento.
  Regras travadas aqui:
   1. visita confirmada = pedido "agendado" com data — uma regra só, para a Agenda do parceiro e para o painel do avaliador;
   2. a Agenda junta os horários dos pedidos de serviço e as visitas confirmadas, em ordem, e cada item leva à sua tela;
   3. a leitura das visitas é a de vistoria_pedidos (a mesma fonte da tela do pedido); se falhar, a Agenda avisa;
   4. o combinado com o avaliador continua à vista depois de a visita ser agendada.
  Roda: node --test src/lib/vistoria/e1103-visita-na-agenda.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_VISITA_NA_AGENDA, hrefDaVisita, visitaConfirmada, visitasNaAgenda } from "./visitas-confirmadas.ts";
import { resumoDoPainel } from "./painel-avaliador.ts";
import { hrefDoItemDaAgenda, itensDaAgenda, ordenarAgenda } from "../parceiros/agenda-parceiro.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E1103 (1): visita confirmada é o pedido 'agendado' com data — proposta de data, sem data ou visita já feita não são", () => {
  assert.equal(visitaConfirmada({ status: "agendado", agendado_para: "2026-11-22T19:00:00Z" }), true);
  // Imóvel ocupado: a data proposta espera o morador; o pedido segue "designado" até ele concordar.
  assert.equal(visitaConfirmada({ status: "designado", agendado_para: "2026-11-22T19:00:00Z" }), false);
  assert.equal(visitaConfirmada({ status: "agendado", agendado_para: null }), false);
  for (const status of ["pedido", "realizada", "laudo_emitido", "cancelada", "ausencia"]) {
    assert.equal(visitaConfirmada({ status, agendado_para: "2026-11-22T19:00:00Z" }), false, status);
  }
});

test("E1103 (2): as visitas confirmadas viram itens da Agenda — dia e hora de Brasília, o rótulo e o destino", () => {
  const itens = visitasNaAgenda([
    { id: "v1", status: "agendado", agendado_para: "2026-11-22T19:00:00Z", cidade: "Uberlândia" }, // 16:00 em Brasília
    { id: "v2", status: "designado", agendado_para: "2026-11-23T13:00:00Z", cidade: "Uberlândia" }, // data só proposta
    { id: "v3", status: "agendado", agendado_para: "2026-11-25T01:30:00Z" }, // 24/11 22:30 em Brasília (o dia não é o de UTC)
  ]);
  assert.deepEqual(itens, [
    { id: "v1", dia: "2026-11-22", quando: "22/11/2026 16:00 (horário de Brasília)", categoria: "Visita de avaliação · Uberlândia", href: "/dashboard/parceiro/avaliacao/v1", em: "2026-11-22T19:00:00Z" },
    { id: "v3", dia: "2026-11-24", quando: "24/11/2026 22:30 (horário de Brasília)", categoria: "Visita de avaliação", href: "/dashboard/parceiro/avaliacao/v3", em: "2026-11-25T01:30:00Z" },
  ]);
  assert.equal(ROTULO_VISITA_NA_AGENDA, "Visita de avaliação");
  assert.equal(hrefDaVisita("abc"), "/dashboard/parceiro/avaliacao/abc");
});

test("E1103 (2): uma agenda só — serviços e visitas em ordem; cada item leva à sua tela; o dia filtra os dois", () => {
  const servico = { id: "s1", dia: "2026-11-23", quando: "23/11/2026 09:00 (horário de Brasília)", categoria: "Limpeza", em: "2026-11-23T12:00:00Z" };
  const antigo = { id: "s0", dia: "2026-11-30", quando: "30/11", categoria: "Limpeza" }; // sem instante: fica no fim
  const visitas = visitasNaAgenda([
    { id: "v2", status: "agendado", agendado_para: "2026-11-24T14:00:00Z" },
    { id: "v1", status: "agendado", agendado_para: "2026-11-22T19:00:00Z" },
  ]);
  const agenda = ordenarAgenda([antigo, servico, ...visitas]);
  assert.deepEqual(agenda.map((i) => i.id), ["v1", "s1", "v2", "s0"]);
  assert.equal(hrefDoItemDaAgenda(agenda[0]), "/dashboard/parceiro/avaliacao/v1");
  assert.equal(hrefDoItemDaAgenda(agenda[1]), "/dashboard/servicos/pedidos/s1");
  assert.deepEqual(itensDaAgenda(agenda, "2026-11-22").map((i) => i.id), ["v1"]);
});

test("E1103 (1): o painel do avaliador conta as visitas de hoje pela mesma regra", () => {
  const base = { recebido_marcado_em: null, valor_tabela: 350, valor_proposto: null, proposta_aceita_em: null, teste: false };
  const agora = new Date("2026-11-22T15:00:00Z");
  const r = resumoDoPainel(
    [
      { ...base, status: "agendado", agendado_para: "2026-11-22T19:00:00Z" },
      { ...base, status: "designado", agendado_para: "2026-11-22T20:00:00Z" }, // proposta de data: não conta
      { ...base, status: "agendado", agendado_para: "2026-11-23T19:00:00Z" }, // amanhã
    ],
    0,
    agora,
  );
  assert.equal(r.visitasHoje, 1);
  assert.match(semComentarios(ler("src/lib/vistoria/painel-avaliador.ts")), /pedidos\.filter\(\(p\) => visitaConfirmada\(p\) && diaBRT\(p\.agendado_para\) === hoje\)/);
});

test("E1103 (2 e 3): a Agenda do painel do parceiro lê as visitas de vistoria_pedidos e junta com os serviços", () => {
  const painel = semComentarios(ler("src/components/parceiros/pedidos-do-parceiro.tsx"));
  assert.match(painel, /const \{ visitas, falhou: visitasFalharam \} = await visitasConfirmadasDoAvaliador\(\);/);
  assert.match(painel, /const agenda = ordenarAgenda\(\[\.\.\.servicos, \.\.\.visitasNaAgenda\(visitas\)\]\);/);
  assert.match(painel, /<AgendaCalendario hoje=\{hoje\} itens=\{agenda\} \/>/);
  // A leitura que falha avisa: uma visita marcada não some calada.
  assert.match(painel, /\{visitasFalharam && \(\s*<p role="alert"[^>]*data-testid="parceiro-agenda-visitas-erro">/);
  // Os pedidos de serviço seguem como eram (lidos com "exigir").
  assert.match(painel, /await pedidosDoMeuParceiro\(\{ exigir: true \}\)/);
  const srv = semComentarios(ler("src/lib/vistoria/visitas-do-avaliador-servidor.ts"));
  assert.match(srv, /^import "server-only";/);
  assert.match(srv, /\.from\("vistoria_pedidos"\)\s*\.select\("id, status, agendado_para, cidade"\)\s*\.in\("avaliador_id", ids\)\s*\.eq\("status", "agendado"\)\s*\.not\("agendado_para", "is", null\)/);
  // Só as do avaliador da sessão: o credenciamento do parceiro (ou da pessoa) que está na sessão.
  assert.match(srv, /\.or\(parc \? `parceiro_id\.eq\.\$\{parc\.id\},user_id\.eq\.\$\{user\.id\}` : `user_id\.eq\.\$\{user\.id\}`\)/);
  assert.match(srv, /if \(error\) return \{ visitas: \[\], falhou: true \};/);
  const cal = semComentarios(ler("src/components/parceiros/agenda-calendario.tsx"));
  assert.match(cal, /<Link href=\{hrefDoItemDaAgenda\(p\)\}[^>]*data-testid="parceiro-agenda-item"/);
});

test("E1103 (4): no bloco do dono, o combinado com o avaliador fica depois do agendamento", () => {
  const dono = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(dono, /\{\["designado", "agendado", "realizada"\]\.includes\(atual\.status\) && atual\.proposta_aceita_em && atual\.valor_proposto != null && \(\s*<p className="text-ink" data-testid="avaliacao-proposta-aceita">\s*Combinado com o avaliador:/);
  assert.doesNotMatch(dono, /atual\.status === "designado" && atual\.proposta_aceita_em && \(\s*<p className="text-ink" data-testid="avaliacao-proposta-aceita">/, "a linha já não depende de o pedido estar só 'designado'");
});
