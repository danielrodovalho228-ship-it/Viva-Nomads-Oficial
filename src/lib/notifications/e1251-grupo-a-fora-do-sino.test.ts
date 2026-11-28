/*
  E1251 (ESPEC-E1251 v3, secção 3.2; ORDENS-DUET 1267 e 1307) — o Grupo A (proposta recebida, proposta a vencer, pedido de
  visita) sai do sino, da faixa, da página completa e da contagem quando a AÇÃO se faz — e também nas duas saídas sem
  ação, onde o crítico ficava aceso para sempre:
   A8  — a proposta vence sem resposta: expirarVencidas resolve os avisos dos dois eventos, das duas partes;
   A10 — a visita deixa de esperar sem o dono responder: o pedido de visita COM referência entra no que a conferência
         grava (a mesma regra da ORDEM-1224, só com referência); o antigo sem referência fica como hoje (A11).
  Camada de unidade sobre a regra única (resolvidosNaPratica → superficieDosAvisos, a de todas as telas) e sobre as
  função real de servidor expirarVencidas com o Supabase falso (harness e1247-rotinas: só server-only e o notify trocados).
  A8 e A10 falham no código de antes; as outras linhas são a prova, por tipo e papel, de que o #4268 cobre o Grupo A.
  Roda: node --test src/lib/notifications/e1251-grupo-a-fora-do-sino.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolvidosNaPratica, superficieDosAvisos, resolucoesConferidasAGravar, type AvisoTela, type SituacaoDosContratos } from "./sino.ts";
import { ASSUNTOS } from "./assuntos.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

register("./e1247-rotinas-harness/loader.mjs", import.meta.url);
const { expirarVencidas } = await import("../data/propostas-servidor.ts");
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(rel, import.meta.url), "utf8"));

const AGORA = "2026-11-28T12:00:00.000Z";
let n = 0;
const aviso = (o: Partial<AvisoTela>): AvisoTela => ({ id: `a${++n}`, evento: "proposta_recebida", prioridade: "critico", titulo: "t", url: "/dashboard/propostas/p1", criado_em: "2026-11-27T10:00:00.000Z", lido_em: null, resolvido_em: null, ref_id: "p1", ...o });
const SEM: SituacaoDosContratos = { assinarPendente: new Set(), aditivoAberto: new Set(), visitaPendente: new Set() };
/** As telas: o que a pessoa vê depois da regra única. `naoLidasBanco` = a contagem lida do banco (já sem os resolvidos). */
function telas(avisos: AvisoTela[], situacao: SituacaoDosContratos = SEM) {
  const noBanco = avisos.filter((a) => !a.resolvido_em && !a.lido_em);
  const resumo = { naoLidas: noBanco.length, maiorPrioridade: noBanco.some((a) => a.prioridade === "critico") ? ("critico" as const) : noBanco.length ? ("normal" as const) : null };
  const s = superficieDosAvisos(resumo, avisos, resolvidosNaPratica(avisos, situacao, AGORA));
  return { lista: s.visiveis.map((a) => a.id), faixa: s.criticos.map((a) => a.id), naoLidas: s.naoLidas, cor: s.maiorPrioridade };
}

// ——— A1–A7 e A9: a ação resolve no banco; a regra única tira-os de todas as superfícies ———
for (const [caso, evento, papel, acao] of [
  ["A1", "proposta_recebida", "dono", "aceita"],
  ["A2", "proposta_recebida", "dono", "recusa"],
  ["A3", "proposta_recebida", "dono", "contrapropõe"],
  ["A4", "proposta_recebida", "morador", "aceita, recusa ou contrapropõe"],
  ["A5", "proposta_vencendo", "dono", "responde"],
  ["A6", "proposta_vencendo", "morador", "responde"],
  ["A9", "visita_pedida", "dono", "confirma, propõe outro horário ou recusa"],
] as const) {
  test(`${caso}. ${evento} (${papel}): ${acao} → sai da lista, da faixa e da página; a contagem desce 1`, () => {
    const antes = aviso({ evento, ref_id: evento === "visita_pedida" ? "v1" : "p1" });
    // A visita ainda espera a resposta do dono (a conferência não a dá por cumprida).
    const vivo = telas([antes], { ...SEM, visitaPendente: new Set(["v1"]) });
    assert.deepEqual([vivo.lista, vivo.faixa, vivo.naoLidas], [[antes.id], [antes.id], 1]);
    const depois = telas([{ ...antes, resolvido_em: AGORA }]);
    assert.deepEqual([depois.lista, depois.faixa, depois.naoLidas], [[], [], 0]);
  });
}

test("A1–A6, A16: as três respostas à proposta resolvem os dois eventos de quem respondeu (a contraproposta cria o da outra parte)", () => {
  const acoes = ler("../data/propostas-actions.ts");
  assert.equal((acoes.match(/resolverAvisos\(\{ usuarioId: s\.user\.id, eventos: EVENTOS_RESPONDER, refId: p\.id \}\)/g) ?? []).length, 3, "recusar, aceitar, contrapropor");
  assert.match(acoes, /EVENTOS_RESPONDER[^=]*=\s*\[\s*"proposta_recebida",\s*"proposta_vencendo"\s*\]/);
  const contra = acoes.slice(acoes.lastIndexOf("await avisarOutraParte(", acoes.indexOf("eventos: EVENTOS_RESPONDER, refId: p.id });\n  return { ok: true, versao }")), acoes.indexOf("eventos: EVENTOS_RESPONDER, refId: p.id });\n  return { ok: true, versao }"));
  assert.match(contra, /"proposta_recebida"/, "A16: a contraproposta avisa a outra parte (proposta recebida)");
  assert.match(ler("../data/visitas-video-actions.ts"), /resolverAvisos\(\{ usuarioId: user\.id, eventos: \["visita_pedida"\], refId: v\.id as string \}\)/, "A9");
});

test("A7. recebida E a vencer da mesma proposta: responder uma vez tira os dois (contagem −2)", () => {
  const r = aviso({ evento: "proposta_recebida" });
  const v = aviso({ evento: "proposta_vencendo" });
  assert.equal(telas([r, v]).naoLidas, 2);
  const d = telas([{ ...r, resolvido_em: AGORA }, { ...v, resolvido_em: AGORA }]);
  assert.deepEqual([d.lista, d.faixa, d.naoLidas], [[], [], 0]);
});

// ——— A8 e A17: a proposta vence ———
function adminDaExpiracao(expiradas: string[]) {
  const chamadas: { tabela: string; op: string; valores?: Record<string, unknown>; filtros: [string, string, unknown][] }[] = [];
  return {
    chamadas,
    from(tabela: string) {
      const c = { tabela, op: "select", valores: undefined as Record<string, unknown> | undefined, filtros: [] as [string, string, unknown][] };
      chamadas.push(c);
      const b: Record<string, unknown> = {};
      b.update = (v: Record<string, unknown>) => ((c.op = "update"), (c.valores = v), b);
      for (const f of ["in", "lt", "eq", "is", "or"]) b[f] = (k: string, v: unknown) => (c.filtros.push([f, k, v]), b);
      b.select = () => b;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(tabela === "propostas" ? { data: expiradas.map((id) => ({ id })), error: null } : { data: null, error: null }).then(ok);
      return b;
    },
  };
}
test("A8. a proposta vence sem resposta: expirarVencidas resolve os avisos dos DOIS eventos, das DUAS partes, só das que expiraram (A17)", async () => {
  const admin = adminDaExpiracao(["p1", "p2"]);
  assert.equal(await expirarVencidas(admin as never), 2);
  const r = admin.chamadas.find((c) => c.tabela === "avisos" && c.op === "update");
  assert.ok(r, "os avisos são resolvidos");
  assert.ok(typeof r!.valores?.resolvido_em === "string");
  assert.deepEqual(r!.filtros.find((f) => f[1] === "ref_id"), ["in", "ref_id", ["p1", "p2"]], "A17: só as propostas que acabaram de expirar");
  assert.deepEqual(r!.filtros.find((f) => f[1] === "evento"), ["in", "evento", ["proposta_recebida", "proposta_vencendo"]]);
  assert.ok(r!.filtros.some((f) => f[0] === "is" && f[1] === "resolvido_em" && f[2] === null));
  assert.ok(!r!.filtros.some((f) => f[1] === "usuario_id"), "as duas partes: não filtra a pessoa");
  // Nada expirou: nada é resolvido.
  const vazio = adminDaExpiracao([]);
  await expirarVencidas(vazio as never);
  assert.equal(vazio.chamadas.filter((c) => c.tabela === "avisos").length, 0);
});
test("A8 (telas). os avisos resolvidos pela expiração saem de todas as superfícies; a contagem desce", () => {
  const d = telas([aviso({ evento: "proposta_recebida", resolvido_em: AGORA }), aviso({ evento: "proposta_vencendo", resolvido_em: AGORA })]);
  assert.deepEqual([d.lista, d.faixa, d.naoLidas, d.cor], [[], [], 0, null]);
});

// ——— A10, A11, A13: a visita deixa de esperar ———
test("A10. pedido de visita COM referência, a visita deixa de esperar sem o dono: sai de tudo, a contagem desce — e FICA GRAVADO", () => {
  const a = aviso({ evento: "visita_pedida", ref_id: "v1" });
  const conferidos = resolvidosNaPratica([a], SEM, AGORA);
  assert.deepEqual(resolucoesConferidasAGravar([a], conferidos), [a.id], "a conferência grava-o");
  const d = telas([a]);
  assert.deepEqual([d.lista, d.faixa, d.naoLidas], [[], [], 0]);
});
test("A11. pedido de visita SEM referência (antigo), nenhum pedido à espera: fica na lista e na página, sai da faixa; a contagem não desce; não é gravado", () => {
  const a = aviso({ evento: "visita_pedida", ref_id: null, url: "/dashboard/visitas" });
  assert.deepEqual(resolucoesConferidasAGravar([a], resolvidosNaPratica([a], SEM, AGORA)), []);
  const d = telas([a]);
  assert.deepEqual([d.lista, d.faixa, d.naoLidas], [[a.id], [], 1]);
});
test("A13. dois pedidos de visita do mesmo dono: o que ainda espera fica", () => {
  const v1 = aviso({ evento: "visita_pedida", ref_id: "v1" });
  const v2 = aviso({ evento: "visita_pedida", ref_id: "v2" });
  const d = telas([v1, v2], { ...SEM, visitaPendente: new Set(["v2"]) });
  assert.deepEqual([d.lista, d.faixa, d.naoLidas], [[v2.id], [v2.id], 1]);
});

// ——— A12: a resolução pela ação é por referência ———
test("A12. duas propostas da mesma pessoa: responder a uma não mexe no aviso da outra (resolverAvisos filtra a pessoa e a referência)", () => {
  const f = ler("./avisos-servidor.ts");
  const corpo = f.slice(f.indexOf("export async function resolverAvisos("), f.indexOf("export async function resolverAvisos(") + 700);
  assert.match(corpo, /\.eq\("usuario_id", p\.usuarioId\)\s*\.eq\("ref_id", p\.refId\)\s*\.in\("evento", p\.eventos\)\s*\.is\("resolvido_em", null\)/);
  const a = aviso({ ref_id: "p1" });
  const b2 = aviso({ ref_id: "p2" });
  const d = telas([{ ...a, resolvido_em: AGORA }, b2]);
  assert.deepEqual([d.lista, d.faixa, d.naoLidas], [[b2.id], [b2.id], 1]);
});

// ——— Guardas ———
test("A14. por resolver: continua na lista, na faixa, na página e na contagem", () => {
  const a = aviso({});
  assert.deepEqual(Object.values(telas([a])).slice(0, 3), [[a.id], [a.id], 1]);
});
test("A15. já lido e resolvido: sai; a contagem não desce outra vez", () => {
  const d = telas([aviso({ lido_em: "2026-11-27T11:00:00.000Z", resolvido_em: AGORA }), aviso({ prioridade: "normal", evento: "new_message", ref_id: null })]);
  assert.equal(d.lista.length, 1);
  assert.equal(d.naoLidas, 1);
});
test("A18. contrato e aditivo com referência: a conferência continua a resolver e a gravar como no #4264 e no #4268", () => {
  const c = aviso({ evento: "contract_status", ref_id: "c0c0c0c0-0000-4000-8000-000000000001", url: null, titulo: "Assinar o contrato — Casa" });
  assert.deepEqual(resolucoesConferidasAGravar([c], resolvidosNaPratica([c], SEM, AGORA)), [c.id]);
});
test("A19. a cor do sino: com o crítico resolvido e um normal vivo, deixa de ser a do crítico", () => {
  const d = telas([aviso({ evento: "visita_pedida", ref_id: "v1" }), aviso({ prioridade: "normal", evento: "new_message", ref_id: null })]);
  assert.equal(d.cor, "normal");
});
test("A20. o aviso de ROTINA do contrato (caução em atraso), com o contrato assinado: não é dado por resolvido nem gravado pela conferência", () => {
  const r = aviso({ evento: "contract_status", ref_id: null, titulo: ASSUNTOS.caucaoDevolucaoAtraso, url: "/dashboard/contratos/c0c0c0c0-0000-4000-8000-000000000001" });
  const conferidos = resolvidosNaPratica([r], SEM, AGORA);
  assert.equal(conferidos[0].resolvido_em, null);
  assert.deepEqual(resolucoesConferidasAGravar([r], conferidos), []);
  const d = telas([r]);
  assert.deepEqual([d.lista, d.faixa, d.naoLidas], [[r.id], [r.id], 1]);
});
