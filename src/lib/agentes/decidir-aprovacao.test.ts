/* Roda: node --test src/lib/agentes/decidir-aprovacao.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirAprovacao, moacirAprovouNoTexto, numeroDoPr, type DepsDecidir, type LinhaAprovacao, type PrParaMesclar } from "./decidir-aprovacao.ts";

const agora = new Date("2026-10-10T12:00:00Z");
const linha: LinhaAprovacao = { id: "a1", tipo: "merge_pr", referencia: "PR #341", status: "pendente", hashConteudo: "abc1234", expiraEm: new Date("2026-10-12T12:00:00Z") };
const pr: PrParaMesclar = { aberto: true, sha: "abc1234ffeedd", semConflito: true, checksVerdes: true };

function fake(over: Partial<DepsDecidir> = {}, l: LinhaAprovacao = linha) {
  const estado = { gravadas: [] as string[], expiradas: [] as string[], mescladas: [] as number[], decidida: false };
  const deps: DepsDecidir = {
    agora,
    admin: { id: "u1", ultimoLoginEm: new Date("2026-10-10T11:55:00Z") },
    carregar: async () => ({ ...l }),
    gravar: async (_id, status) => {
      if (estado.decidida) return false;
      estado.decidida = true;
      estado.gravadas.push(status);
      return true;
    },
    expirar: async (id) => void estado.expiradas.push(id),
    merge: { pr: async () => pr, moacirRevisou: async () => true, mesclar: async (n) => (estado.mescladas.push(n), true) },
    ...over,
  };
  return { deps, estado };
}
const ok = { acao: "aprovar", confirmar: true };

test("não-admin = 403 e nada é gravado", async () => {
  const { deps, estado } = fake({ admin: null });
  const r = await decidirAprovacao(deps, "a1", ok);
  assert.equal(r.http, 403);
  assert.equal(estado.gravadas.length, 0);
});

test("sem login recente = 401 e não grava", async () => {
  const { deps, estado } = fake({ admin: { id: "u1", ultimoLoginEm: new Date("2026-10-10T11:00:00Z") } });
  assert.equal((await decidirAprovacao(deps, "a1", ok)).http, 401);
  assert.equal(estado.gravadas.length, 0);
});

test("sem o segundo toque (confirmar) = 428; confirmar vindo como texto não vale", async () => {
  const { deps } = fake();
  assert.equal((await decidirAprovacao(deps, "a1", { acao: "aprovar", confirmar: false })).http, 428);
  assert.equal((await decidirAprovacao(deps, "a1", { acao: "aprovar", confirmar: "true" })).http, 428);
});

test("ação inválida = 400; pedido inexistente = 404", async () => {
  assert.equal((await decidirAprovacao(fake().deps, "a1", { acao: "apagar", confirmar: true })).http, 400);
  assert.equal((await decidirAprovacao(fake({ carregar: async () => null }).deps, "x", ok)).http, 404);
});

test("expirado não vale e fica marcado como expirado", async () => {
  const { deps, estado } = fake({}, { ...linha, expiraEm: agora });
  assert.equal((await decidirAprovacao(deps, "a1", ok)).http, 410);
  assert.deepEqual(estado.expiradas, ["a1"]);
  assert.equal(estado.gravadas.length, 0);
});

test("dupla aprovação é idempotente: a segunda dá 409 e só mescla uma vez", async () => {
  const { deps, estado } = fake();
  const r1 = await decidirAprovacao(deps, "a1", ok);
  const r2 = await decidirAprovacao(deps, "a1", ok);
  assert.equal(r1.http, 200);
  assert.equal(r2.http, 409);
  assert.deepEqual(estado.mescladas, [341]);
});

test("aprovar merge com tudo em ordem mescla", async () => {
  const { deps } = fake();
  const r = await decidirAprovacao(deps, "a1", ok);
  assert.deepEqual(r.corpo, { ok: true, status: "aprovada", mescla: "mesclado" });
});

test("hash diferente: não grava aprovação e não mescla", async () => {
  const { deps, estado } = fake({ merge: { pr: async () => ({ ...pr, sha: "def9999aaaa" }), moacirRevisou: async () => true, mesclar: async () => true } });
  const r = await decidirAprovacao(deps, "a1", ok);
  assert.equal(r.http, 409);
  assert.equal(estado.gravadas.length, 0);
});

test("checks vermelhos, conflito ou PR fechado: aprova mas não mescla", async () => {
  for (const ruim of [{ checksVerdes: false }, { semConflito: false }, { aberto: false }]) {
    const { deps, estado } = fake({ merge: { pr: async () => ({ ...pr, ...ruim }), moacirRevisou: async () => true, mesclar: async () => (estado.mescladas.push(1), true) } });
    const r = await decidirAprovacao(deps, "a1", ok);
    assert.equal(r.corpo.mescla, "pr_nao_pronto");
    assert.equal(estado.mescladas.length, 0);
  }
});

test("sem revisão aprovada do Moacir não mescla", async () => {
  const { deps, estado } = fake({ merge: { pr: async () => pr, moacirRevisou: async () => false, mesclar: async () => (estado.mescladas.push(1), true) } });
  assert.equal((await decidirAprovacao(deps, "a1", ok)).corpo.mescla, "sem_revisao_moacir");
  assert.equal(estado.mescladas.length, 0);
});

test("sem GITHUB_MERGE_TOKEN: registra aprovada e fica aguardando mescla", async () => {
  const { deps, estado } = fake({ merge: undefined });
  const r = await decidirAprovacao(deps, "a1", ok);
  assert.deepEqual(r.corpo, { ok: true, status: "aprovada", mescla: "aguardando_token" });
  assert.deepEqual(estado.gravadas, ["aprovada"]);
});

test("referência estranha ou sem hash nunca mescla", async () => {
  const { deps, estado } = fake({}, { ...linha, referencia: "PR #341; rm -rf" });
  assert.equal((await decidirAprovacao(deps, "a1", ok)).corpo.mescla, "pr_nao_pronto");
  assert.equal(estado.mescladas.length, 0);
});

test("migração e decisão: só registram, sem mescla; recusar não pede confirmação", async () => {
  const mig = fake({}, { ...linha, tipo: "migracao", referencia: "0096" });
  assert.deepEqual((await decidirAprovacao(mig.deps, "a1", ok)).corpo, { ok: true, status: "aprovada" });
  assert.equal(mig.estado.mescladas.length, 0);
  const rec = fake({ admin: { id: "u1", ultimoLoginEm: null } });
  assert.deepEqual((await decidirAprovacao(rec.deps, "a1", { acao: "recusar", confirmar: false })).corpo, { ok: true, status: "recusada" });
});

test("numeroDoPr aceita só PR #N", () => {
  assert.equal(numeroDoPr("PR #341"), 341);
  assert.equal(numeroDoPr("#12"), 12);
  assert.equal(numeroDoPr("0096"), 96);
  assert.equal(numeroDoPr("PR #1; x"), null);
  assert.equal(numeroDoPr(""), null);
});

test("revisão do Moacir: precisa citar #N, o commit e APROVADO", () => {
  const txt = "Abertos: #350 (renato/x, 3d8f15f — faixas) APROVADO: valores batem. #351 (37cb08b) AJUSTAR";
  assert.ok(moacirAprovouNoTexto(txt, 350, "3d8f15f9a696"));
  assert.ok(!moacirAprovouNoTexto(txt, 350, "aaaaaaa1111"));
  assert.ok(!moacirAprovouNoTexto(txt, 351, "37cb08b4911f"));
  assert.ok(!moacirAprovouNoTexto("", 350, "3d8f15f9a696"));
});
