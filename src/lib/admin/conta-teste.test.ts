/*
  Prompt 36, itens 1 e 2 — contas de QA marcadas como teste (0193) e o botão do admin.
  Roda: node --test src/lib/admin/conta-teste.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_CONTA_TESTE, caminhosParaRevalidar, mudarContaTeste, type DepsContaTeste } from "./conta-teste.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const ALVO = "bbbbbbbb-0000-4000-8000-000000000002";

function fakes(o: { userId?: string | null; admin?: boolean; servico?: boolean; grava?: boolean; slug?: string | null } = {}) {
  const chamadas = { gravou: [] as [string, boolean][], log: [] as [string, string, string][], revalidou: [] as string[], ehAdmin: 0 };
  const deps: DepsContaTeste = {
    usuarioId: async () => (o.userId === undefined ? ADMIN : o.userId),
    ehAdmin: async () => {
      chamadas.ehAdmin++;
      return o.admin ?? true;
    },
    servico:
      o.servico === false
        ? null
        : {
            gravarIsTeste: async (id, v) => {
              chamadas.gravou.push([id, v]);
              return o.grava ?? true;
            },
            slugParceiro: async () => (o.slug === undefined ? "paulo-fotos-teste-qa" : o.slug),
          },
    log: async (a, acao, id) => {
      chamadas.log.push([a, acao, id]);
    },
    revalidar: (c, t) => {
      chamadas.revalidou.push(t ? `${c}|${t}` : c);
    },
  };
  return { deps, chamadas };
}

test("admin marca: grava pelo serviço, registra 'marcar_teste' no moderacao_log e revalida vitrines + página + admin", async () => {
  const { deps, chamadas } = fakes();
  const r = await mudarContaTeste(deps, ALVO, true);
  assert.deepEqual(r, { ok: true, isTeste: true });
  assert.deepEqual(chamadas.gravou, [[ALVO, true]]);
  assert.deepEqual(chamadas.log, [[ADMIN, "marcar_teste", ALVO]]);
  assert.deepEqual(chamadas.revalidou, ["/parceiros", "/parceiros/buscar", "/parceiros/fotografos", "/parceiros/paulo-fotos-teste-qa", "/admin|layout"]);
});

test("admin desmarca: 'desmarcar_teste'; conta sem parceiro não revalida página de parceiro", async () => {
  const { deps, chamadas } = fakes({ slug: null });
  const r = await mudarContaTeste(deps, ALVO, false);
  assert.deepEqual(r, { ok: true, isTeste: false });
  assert.deepEqual(chamadas.log, [[ADMIN, "desmarcar_teste", ALVO]]);
  assert.ok(!chamadas.revalidou.some((c) => /^\/parceiros\/(?!buscar|fotografos)/.test(c)));
});

test("não admin (ou sem sessão) é recusado: nada gravado, nada no log, nada revalidado", async () => {
  for (const o of [{ admin: false }, { userId: null }]) {
    const { deps, chamadas } = fakes(o);
    const r = await mudarContaTeste(deps, ALVO, true);
    assert.deepEqual(r, { ok: false, erro: "Sem permissão." });
    assert.equal(chamadas.gravou.length + chamadas.log.length + chamadas.revalidou.length, 0);
  }
});

test("entrada inválida, sem cliente de serviço ou falha ao gravar: erro, sem log", async () => {
  assert.equal((await mudarContaTeste(fakes().deps, "x' or 1=1", true)).ok, false);
  assert.equal((await mudarContaTeste(fakes().deps, ALVO, "sim")).ok, false);
  const semServico = fakes({ servico: false });
  assert.deepEqual(await mudarContaTeste(semServico.deps, ALVO, true), { ok: false, erro: "Indisponível agora." });
  const falha = fakes({ grava: false });
  assert.equal((await mudarContaTeste(falha.deps, ALVO, true)).ok, false);
  assert.equal(falha.chamadas.log.length, 0);
});

test("slug estranho não vira caminho revalidado", () => {
  assert.ok(!caminhosParaRevalidar("../admin").some((c) => c.caminho.includes("..")));
  assert.equal(caminhosParaRevalidar(null).at(-1)?.tipo, "layout");
});

test("a server action liga ehAdmin, o cliente de serviço, o log 'perfil' e revalidatePath", () => {
  const s = ler("src/lib/data/conta-teste-actions.ts");
  assert.match(s, /^"use server";/);
  assert.match(s, /ehAdmin: \(userId\) => ehAdmin\(supabase, userId\)/);
  assert.match(s, /createAdminClient\(\)/);
  assert.match(s, /admin\.from\("profiles"\)\.update\(\{ is_teste: valor \}\)\.eq\("id", id\)/);
  assert.match(s, /logModeracao\(supabase, adminId, acao, "perfil", id\)/);
  assert.match(s, /revalidatePath\(caminho, tipo\)/);
});

test("/admin/usuarios: botão com a confirmação na página e o texto pedido, sem window.confirm", () => {
  assert.equal(AVISO_CONTA_TESTE, "Contas de teste ficam fora dos números reais, das buscas públicas e recebem e-mails na caixa de teste.");
  const c = ler("src/app/(dashboard)/admin/usuarios/conta-teste.tsx");
  assert.match(c, /<ConfirmarNaPagina/);
  assert.match(c, /aviso=\{AVISO_CONTA_TESTE\}/);
  assert.match(c, /"Marcar como conta de teste"/);
  assert.match(c, /"Desmarcar"/);
  assert.match(c, /startTransition\(\(\) => router\.refresh\(\)\)/);
  assert.doesNotMatch(c, /window\.confirm|alert\(/);
  assert.match(ler("src/app/(dashboard)/admin/usuarios/page.tsx"), /<BotaoContaTeste id=\{u\.id\} isTeste=\{!!u\.is_teste\} \/>/);
});

const CONTAS = ["proprietario2", "proprietario3cnpj", "inquilino2", "proprietario-qa", "teste-qa-2026"];

test("0193: marca só as cinco contas de QA (padrão da 0135), sem e-mail no aviso", () => {
  const m = ler("supabase/migrations/0193_contas_qa_teste.sql");
  assert.match(m, /update public\.profiles\s+set is_teste = true\s+where not is_teste\s+and lower\(split_part\(email, '@', 1\)\) in \(/);
  for (const c of CONTAS) assert.ok(m.includes(`'${c}'`), c);
  const a = ler("supabase/producao/aplicar-0193.sql");
  assert.match(a, /^begin;$/m);
  assert.match(a, /^commit;$/m);
  assert.match(a, /get diagnostics v_qtd = row_count;/);
  assert.match(a, /raise notice '0193: % conta\(s\) de QA marcada\(s\) como teste', v_qtd;/);
  assert.doesNotMatch(a.match(/raise notice[^;]*;/)?.[0] ?? "", /email|@/);
  assert.match(a, /'20261019000193', '0193_contas_qa_teste'/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261019000193'\)/);
  for (const c of CONTAS) assert.ok(a.includes(`'${c}'`), c);
  const r = ler("supabase/producao/rollback/0193_rollback.sql");
  assert.match(r, /set is_teste = false\s+where is_teste\s+and lower\(split_part\(email, '@', 1\)\) in \(/);
  for (const c of CONTAS) assert.ok(r.includes(`'${c}'`), c);
  assert.doesNotMatch(r, /'proprietario1'|'inquilino1'/);
  assert.match(r, /and lower\(email\) not like '%@lab\.vivanomads\.test'/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261019000193'/);
});
