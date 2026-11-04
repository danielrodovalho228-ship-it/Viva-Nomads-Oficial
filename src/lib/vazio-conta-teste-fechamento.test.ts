/*
  Estados vazios / falha de leitura nos fluxos de dinheiro e contrato:
  1. contaEhDeTeste: falha ao ler profiles.is_teste NÃO vira "conta real" (antes, a conta de teste com a leitura falha
     recebia cobrança real no Asaas, contrato real no ZapSign e laudo CAF pago). Agora a leitura falha lança, e as rotas
     de comissão, contrato e verificação respondem 503 sem efeito real.
  2. carregarFechamento: falha ao ler o perfil do dono ou do inquilino não vira "Proprietário"/"Inquilino" sem e-mail
     no contrato e na cobrança.
  Roda: node --test src/lib/vazio-conta-teste-fechamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contaEhDeTeste } from "./contas-de-teste.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const adminCom = (r: { data?: unknown; error?: unknown; lanca?: boolean }) =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (r.lanca) throw new Error("rede");
            return { data: r.data ?? null, error: r.error ?? null };
          },
        }),
      }),
    }),
  }) as never;

test("contaEhDeTeste: erro do banco ou exceção NÃO viram conta real (lança); sem linha segue conta real", async () => {
  await assert.rejects(contaEhDeTeste(adminCom({ error: { message: "timeout" } }), "u1"));
  await assert.rejects(contaEhDeTeste(adminCom({ lanca: true }), "u1"));
  assert.equal(await contaEhDeTeste(adminCom({ data: { is_teste: true } }), "u1"), true);
  assert.equal(await contaEhDeTeste(adminCom({ data: null }), "u1"), false);
});

test("rotas de efeito real: sem saber se é conta de teste, 503 e nada vai ao Asaas, ZapSign ou CAF", () => {
  const con = ler("src/app/api/contrato/route.ts");
  assert.match(con, /contaEhDeTeste\(admin, f\.tenantId\)\)\)\(\)\.catch\(\(\) => "falhou" as const\)/);
  assert.ok(con.indexOf('teste === "falhou"') < con.indexOf("await createContract("));
  const caf = ler("src/app/api/caf/verify/route.ts");
  assert.match(caf, /contaEhDeTeste\(admin, user\.id\)\.catch\(\(\) => "falhou" as const\)/);
  assert.ok(caf.indexOf('teste === "falhou"') < caf.indexOf("consumirLimite("));
  const com = ler("src/app/api/comissao/route.ts");
  assert.match(com, /contaEhDeTeste\(admin, f\.tenantId\)\)\)\(\)\.catch\(\(\) => "falhou" as const\)/);
  assert.ok(com.indexOf('teste === "falhou"') < com.indexOf("reservarFechamento("), "nem reserva sem saber");
  assert.ok(com.indexOf("contaEhDeTeste(") < com.indexOf("await createCommissionCharge("));
});

test("fechamento: perfil do dono ou do inquilino sem leitura não vira nome genérico no contrato e na cobrança", () => {
  const f = ler("src/lib/data/fechamento-servidor.ts");
  assert.match(f, /\{ data: dono, error: erroDono \}/);
  assert.match(f, /\{ data: inquilino, error: erroInquilino \}/);
  assert.match(f, /if \(erroDono \|\| erroInquilino\) return \{ status: 503/);
});
