/*
  E1093 (ORDENS 446 e 565) — "não consegui confirmar a sessão" não é "não há sessão".
  Cada leitura do painel confirma a sessão por conta própria (supabase.auth.getUser). Quando essa confirmação falhava
  (rede, limite de pedidos, erro do serviço), a leitura respondia como se ninguém estivesse logado: lista vazia, "não tem
  imóvel", sem cartão. O painel do dono perdia secções sem aviso. A regra agora, numa função só:
    • sem sessão (não há cookie, sessão encerrada)  → null, como antes;
    • confirmação que FALHOU                         → tenta mais uma vez; continuando a falhar, LANÇA com `exigir`
                                                       (a tela avisa) e devolve null sem ele (como antes).
  Roda: node --test src/lib/supabase/e1093-usuario-da-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SessaoNaoConfirmada, confirmacaoFalhou, usuarioDaLeitura, usuarioExigido } from "./usuario-da-leitura.ts";

type Resposta = { data: { user: { id: string } | null }; error: { name?: string; status?: number } | null };
const OK: Resposta = { data: { user: { id: "u1" } }, error: null };
const SEM_SESSAO: Resposta = { data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } };
const TOKEN_INVALIDO: Resposta = { data: { user: null }, error: { name: "AuthApiError", status: 403 } };
const REDE: Resposta = { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } };
const LIMITE: Resposta = { data: { user: null }, error: { name: "AuthApiError", status: 429 } };
const SERVICO: Resposta = { data: { user: null }, error: { name: "AuthApiError", status: 500 } };

function cliente(respostas: Resposta[]) {
  let chamadas = 0;
  return {
    auth: {
      getUser: async () => respostas[Math.min(chamadas++, respostas.length - 1)],
    },
    get chamadas() {
      return chamadas;
    },
  };
}
const semEspera = { esperar: async () => {} };

test("o que conta como confirmação que falhou: rede, limite de pedidos e erro do serviço; sessão ausente ou inválida, não", () => {
  for (const r of [REDE, LIMITE, SERVICO, { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 503 } }, { data: { user: null }, error: { name: "AuthUnknownError" } }]) {
    assert.equal(confirmacaoFalhou(r.error), true, JSON.stringify(r.error));
  }
  for (const r of [SEM_SESSAO, TOKEN_INVALIDO, { data: { user: null }, error: { name: "AuthApiError", status: 401 } }, { data: { user: null }, error: null }]) {
    assert.equal(confirmacaoFalhou(r.error), false, JSON.stringify(r.error));
  }
});

test("sessão confirmada: devolve o usuário, com uma chamada só", async () => {
  const c = cliente([OK]);
  assert.deepEqual(await usuarioDaLeitura(c, { exigir: true, ...semEspera }), { id: "u1" });
  assert.equal(c.chamadas, 1);
});

test("sem sessão: null, sem nova tentativa e sem lançar — com ou sem `exigir`", async () => {
  for (const r of [SEM_SESSAO, TOKEN_INVALIDO]) {
    for (const exigir of [true, false]) {
      const c = cliente([r]);
      assert.equal(await usuarioDaLeitura(c, { exigir, ...semEspera }), null);
      assert.equal(c.chamadas, 1);
    }
  }
});

test("a confirmação falha uma vez e passa na segunda: devolve o usuário (a secção não some)", async () => {
  for (const falha of [REDE, LIMITE, SERVICO]) {
    const c = cliente([falha, OK]);
    assert.deepEqual(await usuarioDaLeitura(c, { exigir: true, ...semEspera }), { id: "u1" });
    assert.equal(c.chamadas, 2);
  }
});

test("a confirmação falha duas vezes: com `exigir` LANÇA (a tela avisa); sem ele, null como antes", async () => {
  const c = cliente([REDE, SERVICO]);
  await assert.rejects(() => usuarioDaLeitura(c, { exigir: true, ...semEspera }), SessaoNaoConfirmada);
  assert.equal(c.chamadas, 2, "uma nova tentativa, não mais");
  assert.equal(await usuarioDaLeitura(cliente([REDE, REDE]), semEspera), null);
});

test("falhou e, na nova tentativa, a sessão não existe: null (deslogado de verdade), sem lançar", async () => {
  assert.equal(await usuarioDaLeitura(cliente([REDE, SEM_SESSAO]), { exigir: true, ...semEspera }), null);
});

test("a nova tentativa espera um instante antes de repetir (não martela o serviço)", async () => {
  const esperas: number[] = [];
  await usuarioDaLeitura(cliente([LIMITE, OK]), { exigir: true, esperar: async (ms) => void esperas.push(ms) });
  assert.equal(esperas.length, 1);
  assert.ok(esperas[0] >= 100 && esperas[0] <= 1000, `espera de ${esperas[0]} ms`);
});

test("usuarioExigido: a leitura que sempre exige — usuário, null sem sessão, e LANÇA quando a confirmação não passa", async () => {
  assert.deepEqual(await usuarioExigido(cliente([OK])), { id: "u1" });
  assert.equal(await usuarioExigido(cliente([SEM_SESSAO])), null);
  await assert.rejects(() => usuarioExigido(cliente([SERVICO, SERVICO])), SessaoNaoConfirmada);
});
