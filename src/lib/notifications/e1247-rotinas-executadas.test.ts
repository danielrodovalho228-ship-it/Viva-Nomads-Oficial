/*
  E1247, passo 1 — ORDEM-DUET 1280: as fugas C1 e C3 da mordida da Pista 3. O caso 5 (estático) não confere a CHAVE nem
  o PAPEL de cada chamada — foi assim que os dois únicos críticos da tabela escaparam:
   C1 — pre-aceitacao-servidor.ts: avisoDaRotina(rotina, "proprietario") fixo → o morador recebia o lembrete do
        pré-aceite a ≤ 24 h como normal;
   C3 — caucao/prazos-servidor.ts: a caução vencida com a chave "caucaoLiberacaoIntegral" → o dono recebia normal, com o
        título da liberação.
  O fecho: as duas ROTINAS REAIS corridas (harness e1247-rotinas-harness: só server-only e o notify trocados), com o
  aviso gravado afirmado — o morador do pré-aceite a ≤ 24 h recebe CRÍTICO e "Responder à proposta"; o dono recebe
  normal; o dono da caução vencida recebe CRÍTICO, com o título ASSUNTOS.caucaoDevolucaoAtraso.
  Roda: node --test src/lib/notifications/e1247-rotinas-executadas.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA = "on";
process.env.NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA = "on";
register("./e1247-rotinas-harness/loader.mjs", import.meta.url);
const { rodarPreAceitacao } = await import("../propostas/pre-aceitacao-servidor.ts");
const { rodarCaucaoPrazos } = await import("../caucao/prazos-servidor.ts");
const { ASSUNTOS } = await import("./assuntos.ts");
const { botaoDaRotina } = await import("./avisos-rotinas-contrato.ts");

type Aviso = { userId?: string; tituloAviso?: string; prioridadeAviso?: string; subject?: string; pushUrl?: string };
const g = globalThis as unknown as { __e1247Avisos?: Aviso[] };
beforeEach(() => {
  g.__e1247Avisos = [];
});

const DONO = "d0d0d0d0-0000-4000-8000-000000000001";
const MORADOR = "a0a0a0a0-0000-4000-8000-000000000002";
const CONTRATO = "c0c0c0c0-0000-4000-8000-000000000003";
const PERFIS: Record<string, { email: string; full_name: string }> = {
  [DONO]: { email: "dono@teste.invalid", full_name: "Dono" },
  [MORADOR]: { email: "morador@teste.invalid", full_name: "Morador" },
};

/** Falso do cliente admin: cada tabela responde pelo que as duas rotinas leem; os updates "marcam" sempre. */
function falsoAdmin(tabelas: Record<string, (filtros: Record<string, unknown>) => unknown>) {
  return {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      let escrita = false;
      const b: Record<string, unknown> = {};
      const resposta = () => (escrita ? { data: { id: "ok" }, error: null } : { data: tabelas[tabela]?.(filtros) ?? null, error: null });
      for (const m of ["select", "in", "not", "is", "order", "limit"]) b[m] = () => b;
      b.eq = (k: string, v: unknown) => ((filtros[k] = v), b);
      b.update = () => ((escrita = true), b);
      b.upsert = () => ((escrita = true), b);
      b.insert = () => ((escrita = true), b);
      b.maybeSingle = async () => resposta();
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(resposta()).then(ok);
      return b;
    },
  };
}
const perfil = (f: Record<string, unknown>) => PERFIS[String(f.id)] ?? null;
const doUsuario = (uid: string) => (g.__e1247Avisos ?? []).filter((a) => a.userId === uid);

test("C1. o pré-aceite a ≤ 24 h: o MORADOR recebe crítico e 'Responder à proposta'; o dono recebe normal", async () => {
  // O prazo acaba a 02/12 15:00 BRT (18:00Z); o lembrete de 24 h sai a 01/12 15:00 BRT; agora, 01/12 15:30 BRT.
  const proposta = {
    id: "p1", numero: "P-0001", owner_id: DONO, tenant_id: MORADOR, lead_id: "l1", property_id: "im1", versao_atual: 1,
    aceita_em: "2026-11-29T18:00:00.000Z", pre_aceitacao_reaberturas: 0, pre_aceitacao_ate: "2026-12-02T18:00:00.000Z",
    pre_aceitacao_lembrete_24h_em: null, pre_aceitacao_lembrete_6h_em: null, properties: { title: "Apto" },
  };
  const admin = falsoAdmin({ propostas: () => [proposta], profiles: perfil, proposta_versoes: () => null });
  const r = await rodarPreAceitacao(admin as never, new Date("2026-12-01T18:30:00.000Z"));
  assert.equal(r.lembretes, 1, "o lembrete de 24 h saiu");
  const [doMorador] = doUsuario(MORADOR);
  const [doDono] = doUsuario(DONO);
  assert.equal(doMorador?.tituloAviso, ASSUNTOS.preAceitacaoLembrete);
  assert.equal(doMorador?.prioridadeAviso, "critico", "C1: o morador recebe o lembrete como CRÍTICO");
  assert.equal(botaoDaRotina(doMorador?.tituloAviso), "Responder à proposta", "a faixa, pelo título gravado, leva a responder");
  assert.equal(doDono?.prioridadeAviso, "normal", "o dono só é informado");
});

test("C3. a caução vencida: o DONO recebe crítico, com o título da devolução em atraso", async () => {
  // Saída 40 dias antes, sem parecer e sem devolução: liberação integral (aviso normal aos dois) e a pendência dos 30 dias.
  const linha = { contrato_id: CONTRATO, saida_em: "2026-10-20", parecer_em: null, liberacao_integral_em: null, avisou_liberacao_em: "2026-10-28T12:00:00.000Z", devolvida_em: null, pendencia_em: null };
  const admin = falsoAdmin({
    contratos: (f) => (f.id === CONTRATO ? { tenant_id: MORADOR, properties: { owner_id: DONO, title: "Apto" } } : []),
    caucao_prazos: () => [linha],
    caucao_desconto_itens: () => [],
    profiles: perfil,
  });
  const r = await rodarCaucaoPrazos(admin as never, new Date("2026-11-29T15:00:00.000Z"));
  assert.equal(r.pendencias, 1, "a pendência dos 30 dias");
  const atraso = doUsuario(DONO).find((a) => a.subject === ASSUNTOS.caucaoDevolucaoAtraso);
  assert.ok(atraso, "o dono recebe o aviso da devolução em atraso");
  assert.equal(atraso!.tituloAviso, ASSUNTOS.caucaoDevolucaoAtraso, "C3: o título é o da devolução em atraso, não o da liberação");
  assert.equal(atraso!.prioridadeAviso, "critico", "C3: o prazo venceu — CRÍTICO");
});
