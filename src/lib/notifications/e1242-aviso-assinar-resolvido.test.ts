/*
  E1242 (ORDENS-DUET 1213, 1220 e 1224; MAPA-E1242 e MAPA-E1247) — o aviso crítico "Assinar o contrato — …" já resolvido
  (a assinatura resolve: a própria para quem assina, a segunda para os dois) continuava no sino dos dois, com o selo
  "Crítico", e contava como não lido. Passa a sair do sino e da contagem, como o aviso da visita de avaliação (E1128);
  na lista "Avisos recentes" fica como histórico. Vale para os dois avisos que a conferência do sino confere pelo
  contrato: assinar (contract_status) e a proposta de alteração da estadia (estadia_aditivo_proposto).
  A rede: o que a conferência do sino deu por resolvido fica gravado no banco — SÓ para avisos COM referência (ORDEM-1224).
  Sem referência, o aviso pode ser de outra rotina que partilha o evento (caução, parcela, pré-aceite — E1247): mesmo com o
  contrato assinado, não é gravado nem sai do sino (a faixa continua a escondê-lo, como hoje).
  Roda: node --test src/lib/notifications/e1242-aviso-assinar-resolvido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as sino from "./sino.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

type A = sino.AvisoTela;
const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const AGORA = "2026-11-27T12:00:00Z";
const base = { prioridade: "critico" as const, titulo: "Assinar o contrato — Studio, estadia de 01/12 a 31/01", url: `/dashboard/contratos/${C1}`, criado_em: "2026-11-27T10:00:00Z", lido_em: null, resolvido_em: null };
const aviso = (o: Partial<A> & { id: string; evento: string }): A => ({ ...base, ...o });
const sit = (assinar: string[], aditivo: string[] = []): sino.SituacaoDosContratos => ({ assinarPendente: new Set(assinar), aditivoAberto: new Set(aditivo) });
const resolucoes = (sino as unknown as { resolucoesConferidasAGravar?: (antes: readonly A[], conferidos: readonly A[]) => string[] }).resolucoesConferidasAGravar;
const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("1. o aviso de assinar resolvido no banco sai do sino e desconta da contagem; a cor deixa de ser crítica", () => {
  const assinado = aviso({ id: "a", evento: "contract_status", ref_id: C1, resolvido_em: AGORA });
  const outro = aviso({ id: "b", evento: "new_message", prioridade: "normal", titulo: "Nova mensagem", url: "/dashboard/mensagens" });
  const r = sino.resumoSemVisitaVencida({ naoLidas: 2, maiorPrioridade: "critico" }, [assinado, outro], new Set(["a"]));
  assert.deepEqual(r.visiveis.map((x) => x.id), ["b"]);
  assert.equal(r.naoLidas, 1);
  assert.equal(r.maiorPrioridade, "normal");
});

test("2. o mesmo para a proposta de alteração da estadia (aditivo) resolvida", () => {
  const aditivo = aviso({ id: "a", evento: "estadia_aditivo_proposto", ref_id: C1, resolvido_em: AGORA, titulo: "Proposta de alteração da estadia" });
  const r = sino.resumoSemVisitaVencida({ naoLidas: 1, maiorPrioridade: "critico" }, [aditivo], new Set(["a"]));
  assert.deepEqual(r, { visiveis: [], naoLidas: 0, maiorPrioridade: null });
});

test("3. guarda: só uma parte assinou — a outra continua com o crítico no sino e na faixa", () => {
  const falta = aviso({ id: "a", evento: "contract_status", ref_id: C1 });
  const conferidos = sino.resolvidosNaPratica([falta], sit([C1]), AGORA);
  const r = sino.resumoSemVisitaVencida({ naoLidas: 1, maiorPrioridade: "critico" }, conferidos, new Set());
  assert.deepEqual(r.visiveis.map((x) => x.id), ["a"]);
  assert.equal(r.naoLidas, 1);
  assert.equal(r.maiorPrioridade, "critico");
  assert.deepEqual(sino.criticosPendentes(r.visiveis).map((x) => x.id), ["a"]);
});

test("4. a rede: com referência e o contrato já assinado, a conferência resolve, sai do sino e fica a gravar", () => {
  const esquecido = aviso({ id: "a", evento: "contract_status", ref_id: C1 });
  const aditivo = aviso({ id: "b", evento: "estadia_aditivo_proposto", ref_id: C2, titulo: "Proposta de alteração da estadia" });
  const antes = [esquecido, aditivo];
  const conferidos = sino.resolvidosNaPratica(antes, sit([], []), AGORA);
  assert.equal(typeof resolucoes, "function", "sino exporta resolucoesConferidasAGravar");
  assert.deepEqual(resolucoes!(antes, conferidos), ["a", "b"]);
  const r = sino.resumoSemVisitaVencida({ naoLidas: 2, maiorPrioridade: "critico" }, conferidos, new Set());
  assert.deepEqual(r, { visiveis: [], naoLidas: 0, maiorPrioridade: null });
});

test("5. TRAVA (ORDEM-1224): sem referência, mesmo com o contrato assinado, a rede NÃO grava e o aviso fica no sino", () => {
  // O caso do E1247: "Pagamento registrado pelo morador: confirme o recebimento" viaja como contract_status, sem ref_id,
  // com o contrato no endereço. A conferência esconde-o da faixa (como hoje), mas não o dá por resolvido no banco.
  const semRef = aviso({ id: "a", evento: "contract_status", ref_id: null, titulo: "Atualização do seu contrato" });
  const conferidos = sino.resolvidosNaPratica([semRef], sit([]), AGORA);
  assert.deepEqual(resolucoes!([semRef], conferidos), [], "nada a gravar");
  const r = sino.resumoSemVisitaVencida({ naoLidas: 1, maiorPrioridade: "critico" }, conferidos, new Set());
  assert.deepEqual(r.visiveis.map((x) => x.id), ["a"], "continua no sino");
  assert.equal(r.naoLidas, 1, "continua a contar");
});

test("6. guarda do E1128: a visita de avaliação vencida sai e grava como hoje; um aviso resolvido de outro evento fica", () => {
  const visita = aviso({ id: "a", evento: "vistoria_agendada", prioridade: "normal", ref_id: C1, titulo: "Visita de avaliação agendada" });
  const vencida = { ...visita, resolvido_em: AGORA };
  assert.deepEqual(resolucoes!([visita], [vencida]), ["a"]);
  const proposta = aviso({ id: "b", evento: "proposal_received", ref_id: C2, resolvido_em: AGORA, titulo: "Proposta recebida" });
  const r = sino.resumoSemVisitaVencida({ naoLidas: 2, maiorPrioridade: "critico" }, [vencida, proposta], new Set(["b"]));
  assert.deepEqual(r.visiveis.map((x) => x.id), ["b"], "a regra é a dos avisos que o sino confere pelo contrato");
  // o já resolvido no banco não volta a gravar
  assert.deepEqual(resolucoes!([vencida], [vencida]), []);
});

test("7. a rota: grava o que a conferência resolveu e passa ao sino o que já vinha resolvido do banco", () => {
  const rota = semComentarios(ler("app/api/painel/avisos/route.ts"));
  assert.match(rota, /resolucoesConferidasAGravar\(avisos, conferidos\)/);
  assert.match(rota, /gravarResolucaoConferida\(\{ usuarioId: uid, ids: recemVencidos \}\)/);
  assert.match(rota, /resumoSemVisitaVencida\(\{ naoLidas: resumo\.naoLidas, maiorPrioridade \}, conferidos, resolvidosNoBanco\)/);
  assert.match(rota, /const resolvidosNoBanco = new Set\(avisos\.filter\(\(a\) => a\.resolvido_em\)\.map\(\(a\) => a\.id\)\)/);
});
