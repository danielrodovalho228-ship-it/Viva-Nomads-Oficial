/*
  Assinatura: o código por e-mail é conferido no servidor (ordens 810ffe98 / 0a097187).
  Roda: node --test src/lib/contrato-codigo.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  FALHAS_MAX_ASSINATURA,
  MSG_CODIGO_ERRADO,
  MSG_CODIGO_EXPIRADO,
  MSG_SEM_CODIGO,
  conferirCodigo,
  gerarCodigoAssinatura,
  hashCodigoAssinatura,
  incrementarFalhas,
  podeReenviar,
  type LinhaCodigo,
} from "./contrato-codigo.ts";

const U = "u1";
const C = "c1";
const AGORA = Date.parse("2026-10-14T12:00:00Z");
const linha = (o: Partial<LinhaCodigo> = {}): LinhaCodigo => ({
  codigo_hash: hashCodigoAssinatura(U, C, "123456"),
  expira_em: new Date(AGORA + 600_000).toISOString(),
  falhas: 0,
  usado_em: null,
  enviado_em: new Date(AGORA - 120_000).toISOString(),
  ...o,
});

test("código certo passa", () => assert.deepEqual(conferirCodigo(linha(), "123 456", U, C, AGORA), { ok: true }));

test("sem código, sem linha ou formato errado → recusa sem contar falha", () => {
  for (const x of [undefined, "", "12345", "abcdef"]) {
    assert.deepEqual(conferirCodigo(linha(), x, U, C, AGORA), { ok: false, erro: MSG_SEM_CODIGO, contarFalha: false });
  }
  assert.equal(conferirCodigo(null, "123456", U, C, AGORA).ok, false);
});

test("código errado → recusa e conta falha", () =>
  assert.deepEqual(conferirCodigo(linha(), "000000", U, C, AGORA), { ok: false, erro: MSG_CODIGO_ERRADO, contarFalha: true }));

test("vencido, já usado e bloqueado por falhas → recusa mesmo com o código certo", () => {
  const venc = conferirCodigo(linha({ expira_em: new Date(AGORA - 1).toISOString() }), "123456", U, C, AGORA);
  assert.equal(venc.ok === false && venc.erro, MSG_CODIGO_EXPIRADO);
  assert.equal(conferirCodigo(linha({ usado_em: new Date(AGORA).toISOString() }), "123456", U, C, AGORA).ok, false);
  assert.equal(conferirCodigo(linha({ falhas: FALHAS_MAX_ASSINATURA }), "123456", U, C, AGORA).ok, false);
});

test("o código não vale para outra pessoa nem outro contrato", () => {
  assert.equal(conferirCodigo(linha(), "123456", "u2", C, AGORA).ok, false);
  assert.equal(conferirCodigo(linha(), "123456", U, "c2", AGORA).ok, false);
});

test("gera 6 dígitos; reenvio só depois de 1 minuto", () => {
  assert.match(gerarCodigoAssinatura(), /^\d{6}$/);
  assert.equal(gerarCodigoAssinatura(() => 7), "000007");
  assert.equal(podeReenviar(linha({ enviado_em: new Date(AGORA - 10_000).toISOString() }), AGORA), false);
  assert.equal(podeReenviar(linha(), AGORA), true);
});

test("servidor: assinarContrato exige o código e o consome; a senha no navegador deixou de ser a prova", () => {
  const acao = readFileSync(new URL("./data/contrato-assinar-actions.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../components/contrato/assinar-contrato.tsx", import.meta.url), "utf8");
  assert.match(acao, /conferirCodigo\(/);
  assert.match(acao, /contrato_assinatura_codigos/);
  assert.match(acao, /usado_em/);
  assert.match(acao, /export async function pedirCodigoAssinatura/);
  assert.doesNotMatch(tela, /signInWithPassword/);
  assert.match(tela, /pedirCodigoAssinatura/);
});

test("incrementarFalhas: duas tentativas erradas ao mesmo tempo contam as duas (sem perder uma)", async () => {
  // Banco simulado: o "trocar" só vale se o valor ainda for o que foi lido (comparação e troca).
  const banco = { falhas: 0 };
  const lerComPausa = async () => {
    const v = banco.falhas;
    await new Promise((r) => setTimeout(r, 1));
    return v;
  };
  const trocar = async (de: number) => {
    if (banco.falhas !== de) return false;
    banco.falhas = de + 1;
    return true;
  };
  await Promise.all([incrementarFalhas(lerComPausa, trocar), incrementarFalhas(lerComPausa, trocar)]);
  assert.equal(banco.falhas, 2);
});

test("incrementarFalhas: código já usado ou inexistente não conta nada", async () => {
  let trocou = false;
  await incrementarFalhas(async () => null, async () => ((trocou = true), true));
  assert.equal(trocou, false);
});
