/*
  E1128 (ORDENS 563 e 565, linha Parceiros): o dono via no sino o aviso da visita de avaliação de um pedido cujo laudo já
  estava assinado. Causa: os avisos da avaliação eram gravados SEM o pedido (sem ref_id) e nada os dava por resolvidos —
  o aviso "Visita de avaliação agendada" ficava para sempre, fosse qual fosse o estado do pedido. A correção, nas duas
  pontas (a mesma família do E676 e do E1060):
   1. o aviso passa a ser gravado com o pedido (ref_id), e quando a visita deixa de estar por acontecer (concluída, laudo
      emitido, ausência, pedido devolvido ao dono) os avisos de visita desse pedido ficam resolvidos;
   2. o sino confere o estado ATUAL: o aviso de visita só vale enquanto o pedido tem visita por acontecer. Vale também
      para o aviso antigo, sem o pedido: confere pelo imóvel do endereço; sem imóvel, só sai quando a pessoa não tem
      nenhuma visita de avaliação por acontecer (na dúvida, não esconde).
  Roda: node --test src/lib/notifications/e1128-aviso-de-visita-estado-atual.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTOS_VISITA_DE_AVALIACAO, ehAvisoDeVisitaDeAvaliacao, imovelDoAviso, resolvidosNaPratica, resumoSemVisitaVencida, semVisitaDeAvaliacaoVencida, type AvisoTela, type SituacaoDosContratos } from "./sino.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const P_CONCLUIDO = "11111111-1111-4111-8111-111111111111";
const P_AGENDADO = "22222222-2222-4222-8222-222222222222";
const IMOVEL_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IMOVEL_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AGORA = "2026-11-23T12:00:00Z";
const base = { prioridade: "normal" as const, titulo: "Visita de avaliação agendada · Casa", url: `/dashboard/imoveis/${IMOVEL_A}/nivel#avaliacao`, criado_em: "2026-11-21T15:00:00Z", lido_em: null, resolvido_em: null };
const aviso = (o: Partial<AvisoTela> & { id: string; evento: string }): AvisoTela => ({ ...base, ...o });
const situacao = (pedidos: string[], imoveis: string[]): SituacaoDosContratos => ({
  assinarPendente: new Set<string>(),
  aditivoAberto: new Set<string>(),
  avaliacaoComVisita: { pedidos: new Set(pedidos), imoveis: new Set(imoveis) },
});

test("os avisos de visita de avaliação são três: agendada, lembrete e concordância do morador", () => {
  assert.deepEqual([...EVENTOS_VISITA_DE_AVALIACAO], ["vistoria_agendada", "vistoria_lembrete", "vistoria_concordancia"]);
  assert.equal(ehAvisoDeVisitaDeAvaliacao("vistoria_agendada"), true);
  assert.equal(ehAvisoDeVisitaDeAvaliacao("vistoria_laudo_emitido"), false);
  assert.equal(ehAvisoDeVisitaDeAvaliacao("visita_pedida"), false, "a visita ao imóvel (E1060) é outra regra");
});

test("laudo assinado: o aviso da visita desse pedido deixa de valer; o do pedido ainda agendado continua", () => {
  const doConcluido = aviso({ id: "a", evento: "vistoria_agendada", ref_id: P_CONCLUIDO });
  const doAgendado = aviso({ id: "b", evento: "vistoria_agendada", ref_id: P_AGENDADO, url: `/dashboard/imoveis/${IMOVEL_B}/nivel#avaliacao` });
  const r = resolvidosNaPratica([doConcluido, doAgendado], situacao([P_AGENDADO], [IMOVEL_B]), AGORA);
  assert.equal(r[0].resolvido_em, AGORA, "o pedido já tem laudo: não há visita por acontecer");
  assert.equal(r[1].resolvido_em, null, "o outro pedido continua com a visita marcada");
});

test("vale para os três avisos de visita e para qualquer prioridade (não só os críticos)", () => {
  for (const evento of EVENTOS_VISITA_DE_AVALIACAO) {
    for (const prioridade of ["normal", "urgente", "critico"] as const) {
      const a = aviso({ id: evento, evento, prioridade, ref_id: P_CONCLUIDO });
      assert.equal(resolvidosNaPratica([a], situacao([], []), AGORA)[0].resolvido_em, AGORA, `${evento} · ${prioridade}`);
    }
  }
});

test("aviso ANTIGO, sem o pedido: confere pelo imóvel do endereço (o caso de produção: laudo emitido e um pedido novo sem data)", () => {
  const velho = aviso({ id: "v", evento: "vistoria_agendada", ref_id: null });
  assert.equal(imovelDoAviso(velho.url), IMOVEL_A);
  // O imóvel A não tem nenhum pedido com visita por acontecer (o concluído e um novo, ainda sem agendamento).
  assert.equal(resolvidosNaPratica([velho], situacao([P_AGENDADO], [IMOVEL_B]), AGORA)[0].resolvido_em, AGORA);
  // Se o imóvel A tiver uma visita marcada, o aviso antigo continua.
  assert.equal(resolvidosNaPratica([velho], situacao([P_AGENDADO], [IMOVEL_A]), AGORA)[0].resolvido_em, null);
});

test("aviso antigo sem pedido NEM imóvel (o do avaliador): só sai quando a pessoa não tem nenhuma visita por acontecer", () => {
  const doAvaliador = aviso({ id: "x", evento: "vistoria_agendada", ref_id: null, url: "/dashboard/parceiro/avaliacao" });
  assert.equal(imovelDoAviso(doAvaliador.url), null);
  assert.equal(resolvidosNaPratica([doAvaliador], situacao([], []), AGORA)[0].resolvido_em, AGORA);
  assert.equal(resolvidosNaPratica([doAvaliador], situacao([P_AGENDADO], [IMOVEL_B]), AGORA)[0].resolvido_em, null, "na dúvida, não esconde");
});

test("sem a leitura dos pedidos (falhou ou não foi pedida), nada é escondido; aviso já resolvido não muda", () => {
  const a = aviso({ id: "a", evento: "vistoria_agendada", ref_id: P_CONCLUIDO });
  assert.equal(resolvidosNaPratica([a], null, AGORA)[0].resolvido_em, null);
  assert.equal(resolvidosNaPratica([a], { assinarPendente: new Set<string>(), aditivoAberto: new Set<string>() }, AGORA)[0].resolvido_em, null);
  const ja = aviso({ id: "j", evento: "vistoria_agendada", ref_id: P_CONCLUIDO, resolvido_em: "2026-11-22T19:30:00Z" });
  assert.equal(resolvidosNaPratica([ja], situacao([], []), AGORA)[0].resolvido_em, "2026-11-22T19:30:00Z");
});

test("os outros avisos da avaliação (laudo emitido, escolha do avaliador) não são tocados por esta regra", () => {
  const laudo = aviso({ id: "l", evento: "vistoria_laudo_emitido", ref_id: P_CONCLUIDO });
  const escolha = aviso({ id: "e", evento: "vistoria_designado_dono", ref_id: P_CONCLUIDO });
  const r = resolvidosNaPratica([laudo, escolha], situacao([], []), AGORA);
  assert.deepEqual(r.map((x) => x.resolvido_em), [null, null]);
});

test("'um laudo assinado apaga o alerta de visita': o aviso de visita resolvido sai do sino e deixa de contar como não lido", () => {
  const vencidoNaoLido = aviso({ id: "a", evento: "vistoria_agendada", ref_id: P_CONCLUIDO, resolvido_em: AGORA });
  const vencidoLido = aviso({ id: "b", evento: "vistoria_lembrete", ref_id: P_CONCLUIDO, resolvido_em: AGORA, lido_em: AGORA });
  const valido = aviso({ id: "c", evento: "vistoria_agendada", ref_id: P_AGENDADO });
  const contratoResolvido = aviso({ id: "d", evento: "contract_status", prioridade: "critico", resolvido_em: AGORA });
  const r = semVisitaDeAvaliacaoVencida([vencidoNaoLido, vencidoLido, valido, contratoResolvido]);
  assert.deepEqual(r.visiveis.map((x) => x.id), ["c", "d"], "os outros avisos resolvidos continuam no sino, como antes");
  assert.equal(r.naoLidasADescontar, 1, "só o vencido que ainda não foi lido desconta");
});

test("a cor do sino também acompanha: o aviso de visita que saiu não deixa a prioridade dele no sino", () => {
  const lembreteVencido = aviso({ id: "a", evento: "vistoria_lembrete", prioridade: "urgente", ref_id: P_CONCLUIDO, resolvido_em: AGORA });
  const valido = aviso({ id: "c", evento: "vistoria_agendada", ref_id: P_AGENDADO });
  // O resumo foi lido ANTES da conferência: ainda contava o lembrete (2 não lidas, a maior "urgente").
  const r = resumoSemVisitaVencida({ naoLidas: 2, maiorPrioridade: "urgente" }, [lembreteVencido, valido]);
  assert.deepEqual(r.visiveis.map((x) => x.id), ["c"]);
  assert.equal(r.naoLidas, 1);
  assert.equal(r.maiorPrioridade, "normal", "fica a prioridade do aviso que continua, não a do que saiu");
  // Só o vencido: o sino fica sem contagem e sem cor.
  assert.deepEqual(resumoSemVisitaVencida({ naoLidas: 1, maiorPrioridade: "urgente" }, [lembreteVencido]), { visiveis: [], naoLidas: 0, maiorPrioridade: null });
  // A prioridade maior é de OUTRO aviso (um crítico mais antigo, fora da lista): não baixa.
  assert.equal(resumoSemVisitaVencida({ naoLidas: 3, maiorPrioridade: "critico" }, [lembreteVencido, valido]).maiorPrioridade, "critico");
  // O vencido já estava lido: não contava no resumo, nada muda.
  const lido = { ...lembreteVencido, lido_em: AGORA };
  assert.deepEqual(resumoSemVisitaVencida({ naoLidas: 1, maiorPrioridade: "urgente" }, [lido, valido]), { visiveis: [valido], naoLidas: 1, maiorPrioridade: "urgente" });
  // Nada vencido: o resumo passa como veio.
  assert.deepEqual(resumoSemVisitaVencida({ naoLidas: 1, maiorPrioridade: "normal" }, [valido]), { visiveis: [valido], naoLidas: 1, maiorPrioridade: "normal" });
});

test("servidor: o aviso da avaliação é gravado com o pedido, e a visita que deixa de estar por acontecer resolve os avisos", () => {
  const srv = semComentarios(ler("lib/vistoria/servidor.ts"));
  const avisar = srv.slice(srv.indexOf("export async function avisar("), srv.indexOf("export async function avisarAdmins("));
  assert.match(avisar, /refId: ref\?\.pedidoId/, "o aviso fica ligado ao pedido");
  assert.match(srv, /export async function resolverAvisosDaVisita\(/);
  const resolver = srv.slice(srv.indexOf("export async function resolverAvisosDaVisita("));
  assert.match(resolver, /\.eq\("ref_id", pedidoId\)/);
  assert.match(resolver, /\.in\("evento", \[\.\.\.EVENTOS_VISITA_DE_AVALIACAO\]\)/);
  assert.match(resolver, /\.is\("resolvido_em", null\)/);
  // Os quatro pontos em que a visita deixa de estar por acontecer.
  const devolver = srv.slice(srv.indexOf("export async function devolverAoDono("), srv.indexOf("export async function devolverAoDono(") + 1400);
  assert.match(devolver, /resolverAvisosDaVisita\(admin, pedidoId\)/, "pedido devolvido ao dono (recusa, prazo, ausência do avaliador)");
  assert.match(semComentarios(ler("lib/vistoria/laudo-actions.ts")), /resolverAvisosDaVisita\(c\.admin, c\.p\.id\)/, "visita concluída");
  assert.match(semComentarios(ler("lib/vistoria/laudo-servidor.ts")), /resolverAvisosDaVisita\(admin, p\.id\)/, "laudo emitido");
  assert.match(semComentarios(ler("lib/vistoria/actions.ts")), /status: "ausencia"[\s\S]{0,200}resolverAvisosDaVisita\(s\.admin, p\.id\)/, "ausência registrada");
});

test("sino: a rota confere os avisos de visita de avaliação com o estado atual dos pedidos", () => {
  const rota = semComentarios(ler("app/api/painel/avisos/route.ts"));
  assert.match(rota, /ehAvisoDeVisitaDeAvaliacao\(a\.evento\)/);
  assert.match(rota, /avaliacao: /);
  assert.match(rota, /resumoSemVisitaVencida\(\{ naoLidas: resumo\.naoLidas, maiorPrioridade \}, conferidos\)/, "o vencido sai dos recentes, da contagem e da cor");
  assert.match(rota, /gravarResolucaoConferida\(\{ usuarioId: uid, ids: recemVencidos \}\)/, "a conferência fica gravada");
  const gravar = semComentarios(ler("lib/notifications/avisos-servidor.ts"));
  const g = gravar.slice(gravar.indexOf("export async function gravarResolucaoConferida("));
  assert.match(g, /\.eq\("usuario_id", p\.usuarioId\)\.in\("id", ids\)\.is\("resolvido_em", null\)/, "só os avisos da própria pessoa");
  const sit = semComentarios(ler("lib/notifications/situacao-contratos.ts"));
  assert.match(sit, /from\("vistoria_pedidos"\)/);
  assert.match(sit, /STATUS_COM_VISITA_POR_ACONTECER/);
  assert.match(sit, /\.not\("agendado_para", "is", null\)/, "só conta o pedido que tem data de visita");
  assert.match(sit, /avaliacaoComVisita/);
});
