/*
  E1174 (ORDENS-DUET 752 e 788; linha Parceiros). A visita CONFIRMADA de uma avaliação aparecia na Agenda do avaliador
  (E1103) e no bloco do imóvel, mas não na Agenda do dono: a Agenda do dono só lia as visitas de interessados, as
  estadias e os bloqueios.
  A cura: a Agenda do dono lê também as visitas de avaliação dos imóveis dele, pela MESMA regra do avaliador
  (visitaConfirmada: pedido "agendado" com data). O imóvel ocupado só chega a "agendado" quando o morador concorda;
  antes disso a data é uma proposta e não entra.
  Roda: node --test src/lib/vistoria/e1174-visita-na-agenda-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_VISITA_NA_AGENDA, hrefDaAvaliacaoDoImovel, visitasNaAgendaDoDono } from "./visitas-confirmadas.ts";
import { ROTULO_TIPO_AGENDA, agruparPorDia, diasDoItem, filtrarPorImovel, type ItemAgenda } from "../agenda.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => semComentarios(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
const TITULOS = new Map([
  ["imovel-a", "Casa das Acácias"],
  ["imovel-b", "Sobrado do Ipê"],
]);
// 22/11/2026 às 16:00 de Brasília.
const QUANDO = "2026-11-22T19:00:00Z";
const pedido = (id: string, property_id: string, status: string, agendado_para: string | null) => ({ id, property_id, status, agendado_para });

test("E1174 (1): a visita confirmada vira um item da Agenda do dono — o imóvel, a hora e o caminho para o bloco da avaliação", () => {
  const itens = visitasNaAgendaDoDono([pedido("p1", "imovel-a", "agendado", QUANDO)], TITULOS);
  // Na Agenda é uma visita presencial como as outras, com a marca `avaliacao`.
  assert.deepEqual(itens, [{ id: "avaliacao-p1", tipo: "visita", avaliacao: true, modalidade: "presencial", propertyId: "imovel-a", imovel: "Casa das Acácias", quando: QUANDO, pessoa: null, href: "/dashboard/imoveis/imovel-a/nivel#avaliacao" }]);
  assert.equal(hrefDaAvaliacaoDoImovel("imovel-a"), "/dashboard/imoveis/imovel-a/nivel#avaliacao");
});

test("E1174 (2): a regra é a do avaliador — proposta de data, pedido sem data e visita já feita ficam de fora", () => {
  const itens = visitasNaAgendaDoDono(
    [
      // Imóvel ocupado: a data proposta espera o morador; o pedido segue "designado" até ele concordar.
      pedido("ocupado-a-espera", "imovel-a", "designado", QUANDO),
      pedido("sem-data", "imovel-a", "agendado", null),
      pedido("feita", "imovel-a", "realizada", QUANDO),
      pedido("laudo", "imovel-a", "laudo_emitido", QUANDO),
      pedido("cancelada", "imovel-a", "cancelada", QUANDO),
      // Depois de o morador concordar, o pedido do imóvel ocupado passa a "agendado": entra.
      pedido("ocupado-concordou", "imovel-b", "agendado", QUANDO),
    ],
    TITULOS,
  );
  assert.deepEqual(itens.map((i) => i.id), ["avaliacao-ocupado-concordou"]);
});

test("E1174 (3): só os imóveis do dono — pedido de um imóvel que não é dele não entra", () => {
  assert.deepEqual(visitasNaAgendaDoDono([pedido("alheio", "imovel-de-outro", "agendado", QUANDO)], TITULOS), []);
});

test("E1174 (4): na Agenda, a visita de avaliação fica no seu dia de Brasília e entra na ordem das visitas — os tipos continuam a ser 4", () => {
  assert.equal(ROTULO_VISITA_NA_AGENDA, "Visita de avaliação");
  // Não há tipo novo: o texto do dia vazio ("Nenhuma visita, entrada, saída ou data bloqueada") continua certo.
  assert.deepEqual(Object.keys(ROTULO_TIPO_AGENDA).sort(), ["bloqueio", "entrada", "saida", "visita"]);
  const [avaliacao] = visitasNaAgendaDoDono([pedido("p1", "imovel-a", "agendado", QUANDO)], TITULOS);
  assert.deepEqual(diasDoItem(avaliacao), ["2026-11-22"]);
  // 23:30 de Brasília do dia 22 é 02:30 UTC do dia 23: continua no dia 22.
  assert.deepEqual(diasDoItem({ ...avaliacao, quando: "2026-11-23T02:30:00Z" }), ["2026-11-22"]);
  const visitaCedo: ItemAgenda = { id: "visita-v1", tipo: "visita", propertyId: "imovel-b", imovel: "Sobrado do Ipê", quando: "2026-11-22T13:00:00Z", modalidade: "presencial", status: "confirmado", pessoa: null, href: "/dashboard/visitas/v1" };
  const visitaTarde: ItemAgenda = { ...visitaCedo, id: "visita-v2", quando: "2026-11-22T21:00:00Z" };
  const saida: ItemAgenda = { id: "saida-c1", tipo: "saida", propertyId: "imovel-a", imovel: "Casa das Acácias", quando: "2026-11-22", pessoa: null, href: "/dashboard/contratos/c1" };
  const bloqueio: ItemAgenda = { id: "bloqueio-b1", tipo: "bloqueio", propertyId: "imovel-a", imovel: "Casa das Acácias", quando: "2026-11-22", ate: "2026-11-22", pessoa: null, href: null };
  const doDia = agruparPorDia([bloqueio, visitaTarde, avaliacao, visitaCedo, saida]).get("2026-11-22") ?? [];
  // Saída primeiro, depois as visitas pela hora (a de avaliação no meio das outras duas), o bloqueio por fim.
  assert.deepEqual(doDia.map((i) => i.id), ["saida-c1", "visita-v1", "avaliacao-p1", "visita-v2", "bloqueio-b1"]);
  // O filtro por imóvel vale para ela como para os outros itens.
  assert.deepEqual(filtrarPorImovel([avaliacao, visitaCedo], "imovel-a").map((i) => i.id), ["avaliacao-p1"]);
});

test("E1174 (estático): a Agenda do dono lê as visitas de avaliação dos imóveis dele, e a falha não some calada", () => {
  const servidor = ler("src/lib/data/agenda-servidor.ts");
  // A mesma fonte da tela do pedido, só os imóveis do dono, só o que pode estar confirmado.
  assert.match(servidor, /admin\.from\("vistoria_pedidos"\)\.select\("id, property_id, status, agendado_para"\)\.in\("property_id", ids\)\.eq\("status", "agendado"\)\.not\("agendado_para", "is", null\)/);
  assert.match(servidor, /itens\.push\(\.\.\.visitasNaAgendaDoDono\(/);
  // Com `exigir` (a tela Agenda), a leitura que falha lança como as outras três.
  assert.match(servidor, /if \(e4 && opcoes\.exigir\) throw new Error\(MSG_AGENDA_NAO_CARREGOU\);/);
});

test("E1174 (estático): a tela dá à visita de avaliação o rótulo do avaliador, sem 'Interessado(a)', e marca a linha", () => {
  const tela = ler("src/app/(dashboard)/dashboard/agenda/agenda-client.tsx");
  // O rótulo é o que o avaliador lê na Agenda dele (uma fonte só).
  assert.match(tela, /import \{ ROTULO_VISITA_NA_AGENDA \} from "@\/lib\/vistoria\/visitas-confirmadas";/);
  assert.match(tela, /if \(i\.avaliacao\) return ROTULO_VISITA_NA_AGENDA;/);
  assert.doesNotMatch(tela, /Visita de avaliação/);
  // Quem vem é o avaliador, não um interessado: a linha de baixo diz só o imóvel.
  assert.match(tela, /\{i\.tipo !== "bloqueio" && !i\.avaliacao && \(/);
  // A linha leva a marca, para a trava de tela a achar.
  assert.match(tela, /data-avaliacao=\{i\.avaliacao \? "1" : undefined\}/);
});
