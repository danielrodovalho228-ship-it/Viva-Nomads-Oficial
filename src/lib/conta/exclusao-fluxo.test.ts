import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmarExclusao, FALHA_HISTORICO, FALHA_TENTE_DE_NOVO, LINK_INVALIDO, type DepsExclusao } from "./exclusao-fluxo.ts";

function deps(over: Partial<DepsExclusao> = {}) {
  const chamadas: string[] = [];
  const d: DepsExclusao = {
    marcarUsado: async () => (chamadas.push("marcar"), true),
    liberar: async () => void chamadas.push("liberar"),
    emailAtual: async () => "ana@exemplo.com",
    situacao: async () => ({ temHistorico: false, temAtivo: false }),
    anonimizar: async () => (chamadas.push("anonimizar"), true),
    apagar: async () => (chamadas.push("apagar"), true),
    ...over,
  };
  return { d, chamadas };
}

test("conta sem contratos é apagada e o link fica usado", async () => {
  const { d, chamadas } = deps();
  assert.deepEqual(await confirmarExclusao(d, "ana@exemplo.com"), { ok: true });
  assert.deepEqual(chamadas, ["marcar", "apagar"]);
});

test("falha ao apagar NÃO gasta o link: ele é liberado e a pessoa é orientada", async () => {
  const { d, chamadas } = deps({ apagar: async () => false });
  const r = await confirmarExclusao(d, "ana@exemplo.com");
  assert.equal(r.ok, false);
  assert.equal(r.error, FALHA_TENTE_DE_NOVO);
  assert.match(r.error!, /mesmo link/);
  assert.ok(chamadas.includes("liberar"));
});

test("erro inesperado (rede/serviço) também libera o link", async () => {
  const { d, chamadas } = deps({ emailAtual: async () => { throw new Error("rede"); } });
  const r = await confirmarExclusao(d, "ana@exemplo.com");
  assert.equal(r.error, FALHA_TENTE_DE_NOVO);
  assert.ok(chamadas.includes("liberar"));
});

test("histórico de contratos: anonimiza; se falhar, libera o link", async () => {
  const ok = deps({ situacao: async () => ({ temHistorico: true, temAtivo: false }) });
  assert.deepEqual(await confirmarExclusao(ok.d, "ana@exemplo.com"), { ok: true, anonymized: true });
  assert.ok(!ok.chamadas.includes("apagar"), "nunca apaga em cascata quem tem histórico");
  const ruim = deps({ situacao: async () => ({ temHistorico: true, temAtivo: false }), anonimizar: async () => false });
  const r = await confirmarExclusao(ruim.d, "ana@exemplo.com");
  assert.equal(r.error, FALHA_HISTORICO);
  assert.ok(ruim.chamadas.includes("liberar"));
  assert.ok(!ruim.chamadas.includes("apagar"));
});

test("contrato ativo bloqueia sem apagar nem anonimizar", async () => {
  const { d, chamadas } = deps({ situacao: async () => ({ temHistorico: true, temAtivo: true }) });
  const r = await confirmarExclusao(d, "ana@exemplo.com");
  assert.equal(r.blocked, true);
  assert.deepEqual(chamadas, ["marcar"]);
});

test("link já usado/expirado ou e-mail trocado: inválido, nada é apagado", async () => {
  const usado = deps({ marcarUsado: async () => false });
  assert.equal((await confirmarExclusao(usado.d, "ana@exemplo.com")).error, LINK_INVALIDO);
  assert.deepEqual(usado.chamadas, []);
  const trocou = deps({ emailAtual: async () => "outra@exemplo.com" });
  assert.equal((await confirmarExclusao(trocou.d, "ana@exemplo.com")).error, LINK_INVALIDO);
  assert.ok(!trocou.chamadas.includes("apagar"));
});

test("conta que já não existe: ok (idempotente)", async () => {
  const { d, chamadas } = deps({ emailAtual: async () => null });
  assert.deepEqual(await confirmarExclusao(d, "ana@exemplo.com"), { ok: true });
  assert.deepEqual(chamadas, ["marcar"]);
});
