/*
  E1077-b1 (ORDEM-DUET-378/379): a lista do piloto da avaliação pela Central (/admin/avaliadores, "Contas no teste da
  avaliação"): listar (nome, e-mail, marca "conta de teste", data de entrada), adicionar por e-mail com nota opcional
  (até 200 caracteres) e remover. Ações com exigirAdmin(); a conta observadora da QA (recusaObservador) só mexe em
  contas is_teste — conta real, só o admin não observador. Entrar na lista não envia aviso nem convite (regra da 0350).
  E-mail que não existe: "Conta não encontrada".
  Roda: node --test src/lib/vistoria/e1077b-piloto-central.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_CONTA_NAO_ENCONTRADA, NOTA_PILOTO_MAX, TEXTO_PILOTO_VAZIO, TITULO_SECAO_PILOTO, emailParaIlike, lerEntradaPiloto, linhasDoPiloto } from "./piloto-central.ts";
import { MSG_OBSERVADOR, recusaComDeps, type DepsObservador } from "../qa/observador-regras.ts";

const ACOES = readFileSync("src/lib/vistoria/actions.ts", "utf8");
const PAGINA = readFileSync("src/app/(dashboard)/admin/avaliadores/page.tsx", "utf8");
const corpo = (nome: string) => {
  const i = ACOES.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, `${nome} existe`);
  const j = ACOES.indexOf("\nexport ", i + 10);
  return ACOES.slice(i, j < 0 ? undefined : j);
};

test("E1077-b1: o formulário — e-mail obrigatório (minúsculo), nota opcional até 200 caracteres", () => {
  assert.deepEqual(lerEntradaPiloto("  Rogerio@Exemplo.com ", ""), { ok: true, email: "rogerio@exemplo.com", nota: null });
  assert.deepEqual(lerEntradaPiloto("a@b.co", " prova   do Gerente "), { ok: true, email: "a@b.co", nota: "prova do Gerente" });
  assert.equal(lerEntradaPiloto("a@b.co", "x".repeat(NOTA_PILOTO_MAX)).ok, true);
  assert.equal(lerEntradaPiloto("a@b.co", "x".repeat(NOTA_PILOTO_MAX + 1)).ok, false);
  assert.equal(lerEntradaPiloto("", "").ok, false);
  assert.equal(lerEntradaPiloto("sem-arroba", "").ok, false);
  assert.equal(emailParaIlike("a_b%c@x.com"), "a\\_b\\%c@x.com");
  assert.equal(MSG_CONTA_NAO_ENCONTRADA, "Conta não encontrada");
});

test("E1077-b1: a lista — nome, e-mail, marca de teste e data de entrada; lista vazia dá a linha vazia", () => {
  assert.deepEqual(linhasDoPiloto([], []), []);
  const l = linhasDoPiloto(
    [
      { user_id: "b", nota: null, criado_em: "2026-11-21T15:00:00Z" },
      { user_id: "a", nota: "prova", criado_em: "2026-11-21T14:00:00Z" },
    ],
    [
      { id: "a", full_name: "Conta Prova", email: "prova@lab.test", is_teste: true },
      { id: "b", full_name: "Rogério Silva", email: "r@x.com", is_teste: false },
    ],
  );
  assert.deepEqual(l.map((x) => [x.userId, x.nome, x.email, x.teste, x.nota]), [
    ["a", "Conta Prova", "prova@lab.test", true, "prova"],
    ["b", "Rogério Silva", "r@x.com", false, null],
  ]);
  assert.match(PAGINA, /TITULO_SECAO_PILOTO/);
  assert.match(PAGINA, /data-testid="avaliadores-piloto"/);
  assert.match(PAGINA, /piloto\.length === 0 && <p[^>]*data-testid="avaliadores-piloto-vazio"[^>]*>\{TEXTO_PILOTO_VAZIO\}/);
  assert.equal(TITULO_SECAO_PILOTO, "Contas no teste da avaliação");
  assert.ok(TEXTO_PILOTO_VAZIO.length > 0);
});

test("E1077-b1: as ações exigem admin, passam pela recusa do observador com a conta como alvo e dizem 'Conta não encontrada'", () => {
  for (const nome of ["adminAdicionarAoPiloto", "adminRemoverDoPiloto"]) {
    const c = corpo(nome);
    assert.match(c, /const a = await exigirAdmin\(\);\s*if \(!a\) return SEM_ACESSO;/, `${nome}: exigirAdmin`);
    assert.match(c, /await recusaObservador\(a\.userId, \{ perfis: \[alvo\] \}\)/, `${nome}: observador só em conta de teste`);
    assert.match(c, /from\("vistoria_piloto"\)/);
  }
  const add = corpo("adminAdicionarAoPiloto");
  assert.match(add, /lerEntradaPiloto\(form\.get\("email"\), form\.get\("nota"\)\)/);
  assert.match(add, /\.ilike\("email", emailParaIlike\(e\.email\)\)/);
  assert.match(add, /if \(!perfil\) return \{ ok: false, erro: MSG_CONTA_NAO_ENCONTRADA \};/);
  assert.match(add, /\.upsert\(\{ user_id: alvo, nota: e\.nota \}, \{ onConflict: "user_id" \}\)/);
  assert.match(corpo("adminRemoverDoPiloto"), /\.delete\(\)\.eq\("user_id", alvo\)/);
});

test("E1077-b1: entrar ou sair da lista não envia aviso nem convite", () => {
  for (const nome of ["adminAdicionarAoPiloto", "adminRemoverDoPiloto"]) {
    assert.doesNotMatch(corpo(nome), /notificar|enviarEmail|sendMail|naFilaDoAdmin|criarAviso|resend|convite/i, nome);
  }
});

const deps = (observador: boolean, teste: string[]): DepsObservador => ({
  qaAdmin: async () => observador,
  donos: async () => [],
  perfisTeste: async (ids) => new Set(ids.filter((id) => teste.includes(id))),
});

test("E1077-b1: a regra do observador com a conta como alvo — conta de teste sim, conta real não; o admin não observador, as duas", async () => {
  // Observador da QA: só a conta de teste.
  assert.equal(await recusaComDeps(deps(true, ["teste"]), "qa", { perfis: ["teste"] }), null);
  assert.equal(await recusaComDeps(deps(true, ["teste"]), "qa", { perfis: ["real"] }), MSG_OBSERVADOR);
  // O admin não observador (o Daniel): qualquer uma.
  assert.equal(await recusaComDeps(deps(false, []), "daniel", { perfis: ["real"] }), null);
  assert.equal(await recusaComDeps(deps(false, ["teste"]), "daniel", { perfis: ["teste"] }), null);
  // Na tela: as linhas de conta real ficam só leitura para o observador (o servidor também recusa).
  assert.match(PAGINA, /soLeituraNaTela\(piloto\.map\(\(l\) => \(\{ id: l\.userId, alvo: \{ perfis: \[l\.userId\] \} \}\)\)\)/);
});
