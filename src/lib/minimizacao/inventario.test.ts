/*
  Prompt 58 — GUARDA do inventário: nenhuma tabela com coluna de dado pessoal nem bucket fica de fora.
  Roda: node --test src/lib/minimizacao/inventario.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { BUCKETS_INVENTARIADOS, INVENTARIO, SEM_DADO_PESSOAL } from "../../config/retencao.ts";
import { eliminaDeVerdade } from "./regras.ts";

const DIR = new URL("../../../supabase/migrations/", import.meta.url);
const migracoes = readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort().map((n) => readFileSync(new URL(n, DIR), "utf8"));

/** Nome de coluna que denuncia dado pessoal (nome, contato, documento, texto livre, arquivo, IP, coordenada…). */
const PESSOAL = /^(full_name|email|phone|telefone|whatsapp|cpf|cnpj|cpf_representante|documento|nome|tenant_name|tenant_contact|visitante_email|visitante_nome|author_name|body|corpo|texto|mensagem|apresentacao|observacao|observacoes|bio|ip|ip_hash|email_hash|lat|lng|local_trabalho|destino|caminho|foto_path|arquivo_path|document_path|storage_path|path|pdf_path|caf_result|fato|comentario|comentario_publico|comment|linkedin_url|avatar_url|dados_recebimento|razao_social|locador_nome|locatario_nome|locador_doc|locatario_doc|imovel_endereco|chave|token|texto_extraido|recusa_texto|motivo|descricao|anexos|destinatario_mascarado|caso_documento_path|sessao|reject_reason)$/;

function tabelasPessoais(): Map<string, Set<string>> {
  const t = new Map<string, Set<string>>();
  const add = (tab: string, col: string) => PESSOAL.test(col) && (t.get(tab) ?? t.set(tab, new Set()).get(tab)!).add(col);
  for (const s of migracoes) {
    for (const m of s.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\s*\);/g)) {
      for (const c of m[2].matchAll(/^\s*([a-z_]+)\s+[a-z]/gm)) add(m[1], c[1]);
    }
    for (const m of s.matchAll(/alter table (?:if exists )?(?:only )?(?:public\.)?([a-z_]+)([\s\S]*?);/g)) {
      for (const c of m[2].matchAll(/add column (?:if not exists )?([a-z_]+)/g)) add(m[1], c[1]);
    }
  }
  // Tabelas de backup/rascunho de migração (_bkp_, _backup_) não são do produto.
  for (const k of [...t.keys()]) if (k.startsWith("_")) t.delete(k);
  return t;
}

function bucketsDasMigracoes(): Set<string> {
  const b = new Set<string>();
  for (const s of migracoes) {
    for (const m of s.matchAll(/insert into storage\.buckets\s*\(([^)]*)\)\s*values\s*([\s\S]*?)(?:on conflict|;)/gi)) {
      for (const v of m[2].matchAll(/\(\s*'([a-z0-9-]+)'/g)) b.add(v[1]);
    }
  }
  return b;
}

const origens = new Set(INVENTARIO.map((x) => x.origem));

test("GUARDA: toda tabela com coluna de dado pessoal está no inventário (ou explicada em SEM_DADO_PESSOAL)", () => {
  const faltam = [...tabelasPessoais()].filter(([t]) => !origens.has(`public.${t}`) && !(t in SEM_DADO_PESSOAL)).map(([t, c]) => `${t} (${[...c].join(", ")})`);
  assert.deepEqual(faltam, [], `fora do inventário de src/config/retencao.ts:\n${faltam.join("\n")}`);
});

test("GUARDA: todo bucket das migrações está no inventário (e nada inventado)", () => {
  const nas = bucketsDasMigracoes();
  assert.ok(nas.size >= 10, `achei só ${nas.size} buckets nas migrações`);
  assert.deepEqual([...nas].filter((b) => !BUCKETS_INVENTARIADOS.includes(b)).sort(), [], "bucket fora do inventário");
  assert.deepEqual(BUCKETS_INVENTARIADOS.filter((b) => !nas.has(b)).sort(), [], "inventário cita bucket que não existe");
});

test("inventário: cada item tem finalidade e gatilho; real só na fase 1 com base proposta/legal e prazo definido", () => {
  const ids = new Set<string>();
  for (const x of INVENTARIO) {
    assert.ok(!ids.has(x.id), `id repetido: ${x.id}`);
    ids.add(x.id);
    assert.ok(x.finalidade.length > 3 && x.dado.length > 3, x.id);
    if (x.base === "pendente") assert.equal(eliminaDeVerdade(x), false, `${x.id}: prazo pendente nunca apaga de verdade`);
  }
  const reais = INVENTARIO.filter(eliminaDeVerdade).map((x) => x.id).sort();
  assert.deepEqual(reais, ["inquilino-docs/recusado", "matricula/arquivo", "property-photos", "qualificacao/documento"]);
});

test("SEM_DADO_PESSOAL não esconde tabela que está no inventário", () => {
  for (const t of Object.keys(SEM_DADO_PESSOAL)) assert.ok(!origens.has(`public.${t}`), t);
});
