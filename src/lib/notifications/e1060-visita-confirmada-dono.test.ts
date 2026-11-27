/*
  E1060 (prova de 20/11, Mensagens): visita proposta e confirmada, mas (1) o dono abria /dashboard/visitas e via
  "Nenhuma visita ainda", e (2) o crítico "Pedido de visita" ("Confirmar a visita") continuava na faixa depois de confirmada.
  (1) Sem ?de=dono, a página mostrava só as visitas que a pessoa PEDIU; quem só RECEBEU visitas (o dono) caía na lista
  vazia. Agora, sem pedidos próprios e com visitas recebidas, a página abre a lista do dono.
  (2) A faixa confere a situação real da visita (como o E676 faz com o contrato): o "Pedido de visita" só vale enquanto a
  visita ainda espera a resposta do dono (status "pedido"). Confirmada, remarcada, recusada ou cancelada, sai — mesmo que a
  resolução gravada na ação não tenha chegado ao aviso.
  Roda: node --test src/lib/notifications/e1060-visita-confirmada-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolvidosNaPratica, type AvisoTela } from "./sino.ts";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const V1 = "33333333-3333-4333-8333-333333333333";
const V2 = "44444444-4444-4444-8444-444444444444";
const base = { prioridade: "critico" as const, titulo: "Pedido de visita", url: "/dashboard/visitas?de=dono", criado_em: "2026-11-20T15:20:00Z", lido_em: null, resolvido_em: null };
const aviso = (o: Partial<AvisoTela> & { id: string; evento: string }): AvisoTela => ({ ...base, ...o });

test("E1060: visita já confirmada → o crítico 'Pedido de visita' sai da faixa; visita ainda pedida → fica", () => {
  const confirmada = aviso({ id: "a", evento: "visita_pedida", ref_id: V1 });
  const pedida = aviso({ id: "b", evento: "visita_pedida", ref_id: V2 });
  const sit = { assinarPendente: new Set<string>(), aditivoAberto: new Set<string>(), visitaPendente: new Set([V2]) };
  const r = resolvidosNaPratica([confirmada, pedida], sit, "2026-11-20T15:30:00Z");
  assert.ok(r[0].resolvido_em, "V1 já foi confirmada pelo dono");
  assert.equal(r[1].resolvido_em, null, "V2 ainda espera resposta");
});

test("E1060: aviso antigo sem a visita (sem ref_id) sai quando o dono não tem nenhum pedido de visita à espera", () => {
  const velho = aviso({ id: "v", evento: "visita_pedida", ref_id: null });
  const semPendentes = { assinarPendente: new Set<string>(), aditivoAberto: new Set<string>(), visitaPendente: new Set<string>() };
  assert.ok(resolvidosNaPratica([velho], semPendentes, "2026-11-20T15:30:00Z")[0].resolvido_em);
  const comPendente = { ...semPendentes, visitaPendente: new Set([V2]) };
  assert.equal(resolvidosNaPratica([velho], comPendente, "2026-11-20T15:30:00Z")[0].resolvido_em, null, "na dúvida, não esconde");
});

test("E1060: sem a leitura das visitas (falhou), o aviso de visita não é escondido", () => {
  const a = aviso({ id: "a", evento: "visita_pedida", ref_id: V1 });
  const semVisitas = { assinarPendente: new Set<string>(), aditivoAberto: new Set<string>() };
  assert.equal(resolvidosNaPratica([a], semVisitas, "2026-11-20T15:30:00Z")[0].resolvido_em, null);
});

test("E1060: a rota do sino confere as visitas do 'Pedido de visita', e a página de visitas abre a lista do dono quando a pessoa só recebeu visitas", () => {
  // E1242 reaberto (ORDEM-DUET 1247, asserção alterada): a leitura e a conferência mudaram da rota para avisos-telas.ts,
  // a UMA leitura do sino, da faixa e da página completa.
  const rota = ler("lib/data/avisos-telas.ts");
  assert.match(rota, /visita_pedida/);
  const situacao = ler("lib/notifications/situacao-contratos.ts");
  assert.match(situacao, /from\("visitas_video"\)[\s\S]*?\.eq\("owner_id", userId\)[\s\S]*?\.eq\("status", "pedido"\)/);
  const pagina = ler("app/(dashboard)/dashboard/visitas/page.tsx");
  assert.match(pagina, /listVisitasDono\(/);
  assert.match(pagina, /minhas\.length === 0/);
});
