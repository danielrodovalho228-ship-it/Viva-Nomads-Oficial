/*
  E1112 (ORDEM-DUET-498 §2; achado K1 da auditoria da máscara, ORDEM-497): a página pública do parceiro
  (/parceiros/<slug>) mostra o nome, a descrição e a descrição curta que o próprio parceiro escreve no painel.
  Telefone, e-mail e mensageiros não entram aí. A guarda fica nos dois níveis:
  - na action `salvarPagina`, com a fonte única da casa (`contemContato` → `CONTATO_AVISO`);
  - no banco, com o gatilho da 0057 (`bloqueia_contato_texto`, regra rigorosa) nos três campos, para quem gravar
    fora da action.
  As redes do bloco "Redes" ficam (K4 julgado: desenho aprovado, não é defeito).
  Roda: node --test src/lib/parceiros/e1112-pagina-sem-contacto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTATO_AVISO, contemContato } from "../pedidos/pedidos.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const MIG = "supabase/migrations/0357_pagina_do_parceiro_sem_contato_e1112.sql";
const APLICAR = "supabase/producao/aplicar-0357.sql";
const ROLLBACK = "supabase/producao/rollback/0357_rollback.sql";
const CAMPOS = ["nome_publico", "descricao", "descricao_curta"] as const;

test("E1112 (action): salvarPagina recusa contacto no nome, na descrição e na descrição curta — antes de gravar", () => {
  const acoes = ler("src/lib/parceiros/painel-actions.ts");
  assert.match(acoes, /import \{ CONTATO_AVISO, contemContato \} from "@\/lib\/pedidos\/pedidos";/);
  const fn = acoes.slice(acoes.indexOf("export async function salvarPagina"), acoes.indexOf("function ehWebp"));
  assert.match(fn, /if \(\[nome, descricao, curta\]\.some\(\(t\) => contemContato\(t\)\)\) return \{ ok: false, erro: CONTATO_AVISO \};/);
  // A recusa vem antes do update: nada grava com contacto.
  assert.ok(fn.indexOf("contemContato") < fn.indexOf('.from("parceiros")'), "a recusa tem de vir antes do update");
  // A regra é a da casa (telefone, e-mail, mensageiros) — não uma regex nova.
  for (const t of ["Ligue (34) 99999-1234", "contato@exemplo.com.br", "wa.me/5534999991234", "chama no zap"]) assert.ok(contemContato(t), t);
  assert.ok(!contemContato("Limpeza pós-obra e de mudança em Uberlândia, com equipe própria."));
  assert.ok(CONTATO_AVISO.length > 0);
});

test("E1112 (banco): a 0357 põe o gatilho da 0057 nos três campos da página do parceiro, idempotente", () => {
  const mig = ler(MIG);
  const aplicar = ler(APLICAR);
  for (const sql of [mig, aplicar]) {
    for (const c of CAMPOS) {
      assert.match(sql, new RegExp(`drop trigger if exists contato_parceiro_${c} on public\\.parceiros;`), c);
      assert.match(
        sql,
        new RegExp(`create trigger contato_parceiro_${c} before update of ${c} on public\\.parceiros\\s+for each row execute function public\\.bloqueia_contato_texto\\('${c}', 'rigoroso'\\);`),
        c,
      );
    }
    // Reusa a função da 0057: nenhuma função nova, nenhum dado mexido.
    assert.doesNotMatch(sql, /create (or replace )?function/i);
    assert.doesNotMatch(sql, /^\s*(update|delete from|insert into) public\./im);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /select '20261122000357', '0357_pagina_do_parceiro_sem_contato_e1112'\s+where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261122000357'\)/);
  const rb = ler(ROLLBACK);
  for (const c of CAMPOS) assert.match(rb, new RegExp(`drop trigger if exists contato_parceiro_${c} on public\\.parceiros;`), c);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261122000357'/);
});

test("E1112: o bloco 'Redes' fica como está (K4 julgado na ORDEM-498 §4)", () => {
  const acoes = ler("src/lib/parceiros/painel-actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function salvarPagina"), acoes.indexOf("function ehWebp"));
  assert.match(fn, /const v = validarRede\(r\.chave, e\.redes\?\.\[r\.chave\]\);/);
  assert.doesNotMatch(ler(MIG), /instagram|facebook|tiktok|site/i, "o gatilho não toca nas colunas das redes");
});

// ── ORDEM-DUET-500 §2: o pedido de parceria fecha-se na origem ──────────────────────────────────────────────────
import { validarSolicitacao } from "./regras.ts";

test("E1112 (ORDEM-500): o pedido de parceria com contacto no nome ou na descrição é recusado com o aviso da casa — e não grava", () => {
  const base = { nome: "Ana Limpezas", tipoPessoa: "pj" as const, documento: "11.222.333/0001-81", categorias: ["limpeza"], cidades: ["Uberlândia"], aceite: true, descricao: "Limpeza residencial", emiteNota: true };
  assert.equal(validarSolicitacao(base).ok, true, "o pedido limpo continua a passar");
  for (const descricao of ["Limpeza residencial. Ligue (34) 99999-1234", "Orçamentos: ana@exemplo.com.br", "Chama no zap"]) {
    assert.deepEqual(validarSolicitacao({ ...base, descricao }), { ok: false, erro: CONTATO_AVISO, campo: "descricao" }, descricao);
  }
  assert.deepEqual(validarSolicitacao({ ...base, nome: "Ana 34 99999-1234" }), { ok: false, erro: CONTATO_AVISO, campo: "nome" });
  // A fonte é a mesma (contemContato); a action recusa antes de gravar (validarSolicitacao vem antes do insert e do update).
  const regras = ler("src/lib/parceiros/regras.ts");
  assert.match(regras, /import \{ CONTATO_AVISO, contemContato \} from "\.\.\/pedidos\/pedidos\.ts";/);
  const acoes = ler("src/lib/parceiros/solicitacao-actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function enviarSolicitacao"), acoes.indexOf("export async function pedirNovoLink"));
  const iValida = fn.indexOf("const v = validarSolicitacao(entrada);");
  assert.ok(iValida > 0 && iValida < fn.indexOf('.from("parceiro_solicitacoes").update(') && iValida < fn.indexOf('.from("parceiro_solicitacoes").insert('));
  assert.match(fn, /if \(!v\.ok\) return \{ ok: false, erro: v\.erro, campo: v\.campo \};/);
});
