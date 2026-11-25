/*
  E1084 (ORDEM-DUET-399, classe B): na prova, a lista de escolha dizia "Avaliador Teste QA" e o perfil "Avaliador Teste
  Um" — o nome vinha de parceiros.nome_publico num lado e de outro registo no outro. O nome do avaliador passa a vir da
  CONTA (profiles.full_name, sem as marcas "[TESTE QA]" do começo) em todas as superfícies; o nome do parceiro só entra
  quando a conta não tem nome (nunca o e-mail).
  Roda: node --test src/lib/vistoria/e1084-nome-do-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nomeDoAvaliador, primeiroNomeDoAvaliador } from "./nome-do-avaliador.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E1084: o nome vem da conta; sem nome na conta, o do parceiro; nunca o e-mail nem a marca de teste", () => {
  assert.equal(nomeDoAvaliador("Avaliador Teste Um", "Avaliador Teste QA"), "Avaliador Teste Um");
  assert.equal(nomeDoAvaliador("[TESTE QA] Avaliador Teste Um", "Outro"), "Avaliador Teste Um");
  assert.equal(nomeDoAvaliador("  ", "Ana Lima"), "Ana Lima");
  assert.equal(nomeDoAvaliador("ana@exemplo.com", "Ana Lima"), "Ana Lima");
  assert.equal(nomeDoAvaliador(null, null), "Avaliador");
  assert.equal(primeiroNomeDoAvaliador("[TESTE QA] Marina Costa", null), "Marina");
});

test("E1084: todas as superfícies leem o nome pela mesma fonte (a conta)", () => {
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /parceiros\(nome_publico, user_id\)/);
  assert.match(bloco, /nome: nomeDoAvaliador\(nomes\.get\(d\?\.parceiros\?\.user_id \?\? ""\), d\?\.parceiros\?\.nome_publico\)/);
  const laudo = ler("src/lib/vistoria/laudo-servidor.ts");
  assert.match(laudo, /const nomeAssinante = nomeDoAvaliador\(/);
  assert.match(laudo, /nomeCurto: primeiroNomeDoAvaliador\(/);
  const srv = ler("src/lib/vistoria/servidor.ts");
  assert.match(srv, /export async function nomesDasContas\(/);
  const adminTela = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
  // ORDEM-404 (opção A): o credenciamento ligado só pelo parceiro tem user_id vazio — a conta vem do parceiro.
  assert.match(adminTela, /parceiros\(nome_publico, user_id\)/);
  assert.match(adminTela, /const contaDoCredenciamento = \(c: Cred\) => c\.user_id \?\? c\.parceiros\?\.user_id \?\? null;/);
  assert.match(adminTela, /nomesDasContas\(admin, lista\.map\(contaDoCredenciamento\)\)/);
  assert.match(adminTela, /nomeDoAvaliador\(nomesConta\.get\(contaDoCredenciamento\(c\) \?\? ""\), c\.parceiros\?\.nome_publico \?\? c\.parceiro_solicitacoes\?\.nome\)/);
  // A página pública (avaliadores_publicos) lê o nome da conta na própria função do banco (0351).
  for (const f of ["supabase/migrations/0351_nome_do_avaliador_e1084.sql", "supabase/producao/aplicar-0351.sql"]) {
    const s = ler(f);
    assert.match(s, /create or replace function public\.avaliadores_publicos\(\)/);
    assert.ok(s.includes(String.raw`regexp_replace(btrim(pf.full_name), '^(\[[^\]]*\]\s*)+', '')`), `${f}: o nome da conta sem a marca de teste`);
    assert.match(s, /grant execute on function public\.avaliadores_publicos\(\) to anon, authenticated, service_role;/);
  }
  assert.match(ler("supabase/producao/aplicar-0351.sql"), /'20261122000351', '0351_nome_do_avaliador_e1084'/);
});
