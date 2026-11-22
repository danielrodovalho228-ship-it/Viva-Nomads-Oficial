/*
  E1099 parte 2 (ORDEM-DUET-458 §2 / 460 §1): o "Sobre" do perfil público do credenciado lê um campo NOVO, opcional,
  escrito pelo próprio avaliador na área dele (migração 0355, avaliadores_credenciamento.sobre). A secção "Sobre" do
  perfil só aparece com texto — vazio = secção escondida, nunca caixa vazia.
  Roda: node --test src/lib/vistoria/e1099-sobre-do-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXPLICACAO_SOBRE, normalizarSobre, SOBRE_MAX, TITULO_SOBRE } from "./vitrine-avaliadores.ts";
import { CONTATO_AVISO } from "../pedidos/pedidos.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E1099: a migração 0355 cria o campo opcional, com limite, idempotente, e regista-se", () => {
  const mig = ler("supabase/migrations/0355_sobre_do_avaliador_e1099.sql");
  assert.match(mig, /alter table public\.avaliadores_credenciamento\s+add column if not exists sobre text/);
  assert.match(mig, /char_length\(sobre\) <= 600/);
  assert.doesNotMatch(mig, /not null/i, "opcional");
  const aplicar = ler("supabase/producao/aplicar-0355.sql");
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /add column if not exists sobre text/);
  assert.match(aplicar, /select '20261122000355', '0355_sobre_do_avaliador_e1099'\s+where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261122000355'\)/);
  const rollback = ler("supabase/producao/rollback/0355_rollback.sql");
  assert.match(rollback, /drop column if exists sobre/);
  assert.match(rollback, /delete from supabase_migrations\.schema_migrations where version = '20261122000355'/);
});

test("E1099: o texto do avaliador — aparado, vazio vira nada, acima do limite é recusado", () => {
  assert.equal(SOBRE_MAX, 600);
  assert.equal(TITULO_SOBRE, "Sobre");
  assert.deepEqual(normalizarSobre("  Avalio imóveis mobiliados.  "), { ok: true, valor: "Avalio imóveis mobiliados." });
  assert.deepEqual(normalizarSobre("   \n  "), { ok: true, valor: null });
  assert.deepEqual(normalizarSobre(""), { ok: true, valor: null });
  const longo = normalizarSobre("a".repeat(601));
  assert.equal(longo.ok, false);
  assert.deepEqual(normalizarSobre("a".repeat(600)), { ok: true, valor: "a".repeat(600) });
});

test("E1099 (ORDEM-DUET-498, K2): o 'Sobre' com contacto é recusado com o aviso da casa — nunca grava", () => {
  for (const comContato of [
    "Ligue para (34) 99999-1234 e combinamos.",
    "Escreva para avaliador@exemplo.com.br",
    "Fale comigo em wa.me/5534999991234",
    "Chama no zap que eu respondo.",
  ]) {
    assert.deepEqual(normalizarSobre(comContato), { ok: false, erro: CONTATO_AVISO }, comContato);
  }
  // A guarda é a mesma das outras superfícies (fonte única), não uma regex nova.
  const fonte = ler("src/lib/vistoria/vitrine-avaliadores.ts");
  assert.match(fonte, /import \{ CONTATO_AVISO, contemContato \} from "\.\.\/pedidos\/pedidos\.ts";/);
  assert.match(fonte.slice(fonte.indexOf("export function normalizarSobre")), /if \(contemContato\(t\)\) return \{ ok: false, erro: CONTATO_AVISO \};/);
  // Texto limpo continua a gravar.
  assert.deepEqual(normalizarSobre("Avalio imóveis mobiliados em Uberlândia há 8 anos."), { ok: true, valor: "Avalio imóveis mobiliados em Uberlândia há 8 anos." });
});

test("E1099: o avaliador grava só o PRÓPRIO 'Sobre', na área dele", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function salvarMeuSobre"));
  assert.match(fn, /const s = await sessao\(\);/);
  assert.match(fn, /normalizarSobre\(String\(form\.get\("sobre"\) \?\? ""\)\)/);
  assert.match(fn, /\.update\(\{ sobre: v\.valor \}\)\s*\.or\(parc \? `parceiro_id\.eq\.\$\{parc\.id\},user_id\.eq\.\$\{s\.userId\}` : `user_id\.eq\.\$\{s\.userId\}`\)/);
  const area = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  // ORDEM-462 §1: rótulos aprovados ("Sobre você", "Salvar texto") e a explicação numa frase curta.
  assert.equal(EXPLICACAO_SOBRE, "Este texto aparece no seu perfil público."); // ORDEM-463 §2
  assert.match(area, /data-testid="meu-sobre-explicacao">\{EXPLICACAO_SOBRE\}/);
  assert.match(area, /Sobre você\s*<textarea name="sobre"/);
  assert.match(area, />Salvar texto<\/Button>/);
  assert.match(area, /<FormAcao acao=\{salvarMeuSobre\}[\s\S]*?<textarea name="sobre"[^>]*maxLength=\{SOBRE_MAX\}[^>]*defaultValue=\{cred\.sobre \?\? ""\}/);
});

test("E1099: o perfil público mostra a secção 'Sobre' SÓ com texto (vazio = escondida)", () => {
  const pagina = ler("src/app/(public)/avaliadores/[numero]/page.tsx");
  const credenciado = pagina.slice(pagina.indexOf("export default async function AvaliadorPage"), pagina.indexOf("async function PerfilPublico"));
  assert.match(credenciado, /const sobre = admin \? await sobreDoCredenciado\(admin, a\.numero_credenciado\) : null;/);
  assert.match(credenciado, /\{sobre && \(\s*<section[^>]*data-testid="avaliador-sobre"[\s\S]*?\{TITULO_SOBRE\}[\s\S]*?\{sobre\}/);
  // A ordem do mockup: Novo na Viva / avaliações → Sobre → Preço.
  assert.ok(credenciado.indexOf('data-testid="avaliador-sobre"') > credenciado.indexOf('data-testid="avaliador-novo"'));
  assert.ok(credenciado.indexOf('data-testid="avaliador-sobre"') < credenciado.indexOf('data-testid="avaliador-preco"'));
  const srv = ler("src/lib/vistoria/vitrine-servidor.ts");
  assert.match(srv, /export async function sobreDoCredenciado[\s\S]*?select\("sobre"\)\.eq\("numero_credenciado", numero\)[\s\S]*?normalizarSobre/);
});
