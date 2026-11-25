/*
  E1113 (ORDEM-DUET-498 §3; achado K3 da auditoria da máscara, ORDEM-497): a bio do perfil público
  (`profiles.bio`) já é recusada com contacto pela action (`validarBio`), mas a RLS "perfil próprio: atualiza" (0062)
  deixa o utilizador gravar a bio direto na API. A 0358 fecha o banco com o gatilho da 0057
  (`bloqueia_contato_texto`, regra rigorosa), como o do nome (`contato_perfil_nome`): só na edição.
  Roda: node --test src/lib/perfil/e1113-gatilho-da-bio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarBio } from "./perfil-publico.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E1113 (banco): a 0358 põe o gatilho da 0057 em profiles.bio, só na edição, idempotente", () => {
  const mig = ler("supabase/migrations/0358_bio_sem_contato_e1113.sql");
  const aplicar = ler("supabase/producao/aplicar-0358.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /drop trigger if exists contato_perfil_bio on public\.profiles;/);
    assert.match(sql, /create trigger contato_perfil_bio before update of bio on public\.profiles\s+for each row execute function public\.bloqueia_contato_texto\('bio', 'rigoroso'\);/);
    assert.doesNotMatch(sql, /create (or replace )?function/i, "reusa a função da 0057");
    assert.doesNotMatch(sql, /^\s*(update|delete from|insert into) public\./im, "nenhum dado muda");
    assert.doesNotMatch(sql, /before insert/i, "o cadastro (handle_new_user) não pode falhar");
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /select '20261122000358', '0358_bio_sem_contato_e1113'\s+where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261122000358'\)/);
  const rb = ler("supabase/producao/rollback/0358_rollback.sql");
  assert.match(rb, /drop trigger if exists contato_perfil_bio on public\.profiles;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261122000358'/);
});

test("E1113 (action): a recusa da tela continua — validarBio recusa contacto antes de gravar", () => {
  for (const t of ["Ligue (34) 99999-1234", "dono@exemplo.com.br", "veja www.exemplo.com.br"]) assert.equal(validarBio(t).ok, false, t);
  assert.deepEqual(validarBio("Moro em Uberlândia e alugo para quem vem trabalhar."), { ok: true, valor: "Moro em Uberlândia e alugo para quem vem trabalhar." });
});

// ── ORDEM-DUET-502 §2: app e banco com a mesma regra, sempre ────────────────────────────────────────────────────
import { CONTATO_AVISO, contemContato } from "../pedidos/pedidos.ts";

test("E1113 (ORDEM-502): a tela da bio usa a regra rigorosa do gatilho — o que o banco recusa, a action recusa antes, com o aviso certo", () => {
  // O caso que passava na tela e morria no gatilho com erro genérico.
  assert.deepEqual(validarBio("Respondo rápido pelo whatsapp"), { ok: false, erro: CONTATO_AVISO });
  for (const t of ["Chama no zap", "me chama no telegram", "liga pra mim", "meu número está no anúncio"]) {
    assert.deepEqual(validarBio(t), { ok: false, erro: CONTATO_AVISO }, t);
  }
  // A regra é a fonte única (contemContato, o espelho da regra rigorosa da 0057), não uma regex nova.
  const fonte = readFileSync("src/lib/perfil/perfil-publico.ts", "utf8");
  assert.match(fonte, /import \{ CONTATO_AVISO, contemContato \} from "\.\.\/pedidos\/pedidos\.ts";/);
  assert.match(fonte.slice(fonte.indexOf("export function validarBio")), /if \(contemContato\(t\)\) return \{ ok: false, erro: CONTATO_AVISO \};/);
  assert.ok(contemContato("Respondo rápido pelo whatsapp"));
  // Texto limpo continua a passar.
  assert.equal(validarBio("Instalação nova, apartamento tranquilo perto da faculdade.").ok, true);
});
