/*
  E463 (PC7) — o CPF do parceiro divergia entre telas da MESMA conta: a aba Dados do painel de parceiro mostrava o
  documento do pedido de parceria (parceiros.documento, mascarado) e Conta → Dados dizia CPF "Ainda não informado".
  Duas fontes para o mesmo campo. Correção: a fonte única é o perfil (Conta → Documento, o mesmo do contrato e da
  cobrança). A aba Dados lê o perfil, com o mesmo rótulo e a mesma máscara, e sem documento mostra "Ainda não
  informado" com o caminho de um clique. Na ativação da parceria, o CPF do pedido preenche o perfil só quando o perfil
  ainda não tem documento (PF; nunca sobrescreve).
  Roda: node --test src/lib/parceiros/e463-cpf-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { documentoNaTela } from "../documento-pessoa.ts";
import { preencherCpfDoPerfil } from "./ativacao-nucleo.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("documentoNaTela: a mesma leitura de Conta → Dados (rótulo e máscara do perfil)", () => {
  assert.deepEqual(documentoNaTela({ person_type: "pf", cpf: "52998224725" }), { rotulo: "CPF", mascarado: "***.982.247-**" });
  assert.deepEqual(documentoNaTela({ person_type: "pf", cpf: null }), { rotulo: "CPF", mascarado: null });
  assert.deepEqual(documentoNaTela({ person_type: "pj", cnpj: "11222333000181" }), { rotulo: "CNPJ", mascarado: "11.222.333/****-**" });
  assert.deepEqual(documentoNaTela(null), { rotulo: "CPF", mascarado: null });
});

type Chamada = { tabela: string; op: string; valor?: unknown; filtros: [string, string, unknown][] };
function falso(perfil: Record<string, unknown> | null, erroUpdate: { code: string; message: string } | null = null) {
  const chamadas: Chamada[] = [];
  return {
    chamadas,
    from(tabela: string) {
      const c: Chamada = { tabela, op: "", filtros: [] };
      chamadas.push(c);
      const q = {
        select() { c.op ||= "select"; return q; },
        update(v: unknown) { c.op = "update"; c.valor = v; return q; },
        eq(k: string, v: unknown) { c.filtros.push(["eq", k, v]); return q; },
        is(k: string, v: unknown) { c.filtros.push(["is", k, v]); return q; },
        maybeSingle: async () => ({ data: perfil, error: null }),
        then: (r: (v: unknown) => unknown) => Promise.resolve({ error: erroUpdate }).then(r),
      };
      return q;
    },
  };
}
const solPF = { tipo_pessoa: "pf", documento: "529.982.247-25" };

test("ativação: perfil sem CPF recebe o CPF do pedido (só dígitos, só onde cpf é null)", async () => {
  const a = falso({ person_type: "pf", cpf: null, cnpj: null });
  assert.equal(await preencherCpfDoPerfil(a, "u1", solPF), true);
  const up = a.chamadas.find((c) => c.op === "update")!;
  assert.equal(up.tabela, "profiles");
  assert.deepEqual(up.valor, { cpf: "52998224725" });
  assert.deepEqual(up.filtros, [["eq", "id", "u1"], ["is", "cpf", null]]);
});

test("ativação: nunca sobrescreve nem mexe em PJ, documento inválido ou perfil de empresa", async () => {
  for (const [perfil, sol] of [
    [{ person_type: "pf", cpf: "11144477735" }, solPF],
    [{ person_type: "pj", cpf: null, cnpj: null }, solPF],
    [{ person_type: "pf", cpf: null }, { tipo_pessoa: "pj", documento: "11222333000181" }],
    [{ person_type: "pf", cpf: null }, { tipo_pessoa: "pf", documento: "12345678900" }],
    [null, solPF],
  ] as const) {
    const a = falso(perfil as Record<string, unknown> | null);
    assert.equal(await preencherCpfDoPerfil(a, "u1", sol), false);
    assert.ok(!a.chamadas.some((c) => c.op === "update"), JSON.stringify([perfil, sol]));
  }
});

test("ativação: CPF já de outra conta (23505) não derruba a ativação", async () => {
  const a = falso({ person_type: "pf", cpf: null }, { code: "23505", message: "duplicate key profiles_cpf" });
  assert.equal(await preencherCpfDoPerfil(a, "u1", solPF), false);
});

test("os dois caminhos da ativação preenchem o perfil depois de ativar", () => {
  const acoes = ler("lib/parceiros/ativacao-actions.ts");
  assert.equal((acoes.match(/await preencherCpfDoPerfil\(admin, user\.id, sol\b/g) ?? []).length, 2);
});

test("painel: a aba Dados lê o documento do PERFIL, não o do pedido de parceria", () => {
  const painel = ler("lib/parceiros/painel-actions.ts");
  assert.doesNotMatch(painel, /mascararDoc\(/);
  assert.match(painel, /select\("is_teste, person_type, cpf, cnpj"\)/);
  assert.match(painel, /documento: documentoNaTela\(perfil as PerfilDocumento \| null\)/);
  const tela = ler("app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
  assert.match(tela, /\{p\.documento\.mascarado \?\? "Ainda não informado"\}/);
  assert.match(tela, /data-testid="parceiro-documento-informar"/);
  assert.match(tela, /href=\{LINK_DOCUMENTO\}/);
  assert.doesNotMatch(tela, /Tipo e documento não mudam por aqui/);
});
