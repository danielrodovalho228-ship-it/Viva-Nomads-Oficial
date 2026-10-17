import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contaEhDeTeste,
  cobrancaSimuladaTeste,
  contratoSimuladoTeste,
  laudoSimuladoTeste,
  NOTA_VERIFICACAO_TESTE,
  ROTULO_TESTE,
} from "./contas-de-teste.ts";

// Ordem ee7d27b8, itens 1–3: conta is_teste não gera efeito real; conta real segue o caminho de sempre.
const ler = (p: string) => readFileSync(p, "utf8");

const adminCom = (is_teste: unknown, erro = false) =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => { if (erro) throw new Error("x"); return { data: is_teste === undefined ? null : { is_teste } }; } }),
      }),
    }),
  }) as never;

test("contaEhDeTeste: só true quando is_teste é exatamente true", async () => {
  assert.equal(await contaEhDeTeste(adminCom(true), "u1"), true);
  assert.equal(await contaEhDeTeste(adminCom(false), "u1"), false);
  assert.equal(await contaEhDeTeste(adminCom(undefined), "u1"), false);
  assert.equal(await contaEhDeTeste(adminCom("true"), "u1"), false);
  assert.equal(await contaEhDeTeste(adminCom(true, true), "u1"), false);
  assert.equal(await contaEhDeTeste(null, "u1"), false);
  assert.equal(await contaEhDeTeste(adminCom(true), null), false);
});

test("cobrança simulada: rótulo TESTE, mesmo valor da regra (aluguel × meses × taxa)", () => {
  const c = cobrancaSimuladaTeste({ aluguelMensal: 3000, meses: 3, commissionRate: 0.12 });
  assert.equal(c.rotulo, ROTULO_TESTE);
  assert.equal(c.demo, true);
  assert.equal(c.platformCommission, 1080);
  assert.match(c.chargeId, /^teste_/);
});

test("contrato e laudo simulados vêm marcados como TESTE", () => {
  assert.equal(contratoSimuladoTeste().rotulo, "TESTE");
  assert.equal(contratoSimuladoTeste().signUrl, undefined, "sem link do ZapSign");
  assert.deepEqual(laudoSimuladoTeste().notes, [NOTA_VERIFICACAO_TESTE]);
  assert.match(NOTA_VERIFICACAO_TESTE, /^TESTE — verificação simulada$/);
});

test("rotas: conta de teste desvia ANTES de Asaas, ZapSign e CAF; decisão vem do servidor", () => {
  const com = ler("src/app/api/comissao/route.ts");
  assert.match(com, /contaEhDeTeste\(/);
  assert.ok(com.indexOf("contaEhDeTeste(") < com.indexOf("await createCommissionCharge("));
  const con = ler("src/app/api/contrato/route.ts");
  assert.match(con, /contaEhDeTeste\(/);
  assert.ok(con.indexOf("contaEhDeTeste(") < con.indexOf("await createContract("));
  const caf = ler("src/app/api/caf/verify/route.ts");
  assert.match(caf, /contaEhDeTeste\(/);
  assert.ok(caf.indexOf("contaEhDeTeste(") < caf.indexOf("await verifyTenant("));
  assert.ok(caf.indexOf("contaEhDeTeste(") < caf.indexOf("consumirLimite("), "não gasta a cota de 90 dias da conta de teste");
  assert.match(caf, /MSG_VERIFICACAO_EM_BREVE/);
  assert.ok(!/body\.(isTeste|is_teste|teste)/.test(com + con + caf), "o navegador não decide");
});

test("caixa de e-mails da própria conta de teste: rota só da sessão, só linhas dela, só is_teste", () => {
  const r = ler("src/app/api/conta/caixa-teste/route.ts");
  assert.match(r, /auth\.getUser\(\)/);
  assert.match(r, /contaEhDeTeste\(/);
  assert.match(r, /\.eq\("usuario_id", user\.id\)/);
  assert.match(r, /status: 401/);
  assert.match(r, /status: 404/);
  const secao = ler("src/components/account/caixa-emails-teste.tsx");
  assert.match(secao, /\/api\/conta\/caixa-teste/);
  const conta = ler("src/app/(dashboard)/dashboard/conta/page.tsx");
  assert.match(conta, /<CaixaEmailsTeste/);
});
