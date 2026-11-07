/*
  E662 (parte Pista B) — a INSTRUÇÃO ÚNICA de saída (check-out) por contrato: o dono escreve uma vez, o morador e o dono leem o
  MESMO texto. Esta entrega é o dado (migração 0320) e a regra de leitura; as telas são da Pista A.
  Onde grava: no imóvel, em `imovel_instrucoes_chegada.instrucao_saida` (tabela PRIVADA, só o dono lê e grava; nunca na página
  pública — diferente de `properties`, que o visitante lê), e a cópia em `contratos.instrucao_saida`, congelada na 1ª assinatura:
  o texto não muda no meio da estadia. Leitura única: contrato primeiro, imóvel como reserva.
  Roda: node --test src/lib/estadia/instrucao-saida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CAMPOS_INSTRUCOES, instrucoesEfetivas, normalizarInstrucoes } from "./instrucoes.ts";
import { INSTRUCAO_SAIDA_MAX, instrucaoDeSaida, normalizarInstrucaoSaida } from "./instrucao-saida.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");

test("normalizar: corta no limite, tira espaços e vazio vira nulo", () => {
  assert.equal(normalizarInstrucaoSaida("  Deixar as chaves na caixinha até 11h.  "), "Deixar as chaves na caixinha até 11h.");
  assert.equal(normalizarInstrucaoSaida("   "), null);
  assert.equal(normalizarInstrucaoSaida(undefined), null);
  assert.equal(normalizarInstrucaoSaida(42), null);
  assert.equal((normalizarInstrucaoSaida("x".repeat(INSTRUCAO_SAIDA_MAX + 50)) ?? "").length, INSTRUCAO_SAIDA_MAX);
});

test("leitura única: o texto do contrato vale; sem ele, o do imóvel; sem nenhum, nulo — igual para morador e dono", () => {
  assert.equal(instrucaoDeSaida({ doContrato: "Texto congelado", doImovel: "Texto atual" }), "Texto congelado");
  assert.equal(instrucaoDeSaida({ doContrato: null, doImovel: "Texto atual" }), "Texto atual");
  assert.equal(instrucaoDeSaida({ doContrato: "  ", doImovel: " Texto atual " }), "Texto atual");
  assert.equal(instrucaoDeSaida({ doContrato: null, doImovel: null }), null);
});

test("o campo entra nas instruções da estadia (editor do dono, leitura do morador e e-mails) e a cópia do contrato vence", () => {
  const c = CAMPOS_INSTRUCOES.find((x) => x.chave === "instrucao_saida");
  assert.ok(c && c.max === INSTRUCAO_SAIDA_MAX);
  assert.equal(normalizarInstrucoes({ instrucao_saida: "  Sair até 11h  " }).instrucao_saida, "Sair até 11h");
  const ef = instrucoesEfetivas({ instrucao_saida: "do imóvel" }, null, "do contrato");
  assert.equal(ef?.instrucao_saida, "do contrato");
  assert.equal(instrucoesEfetivas({ instrucao_saida: "do imóvel" }, null)?.instrucao_saida, "do imóvel");
});

test("a 1ª assinatura copia o texto para o contrato (uma vez só), sem quebrar a assinatura se a leitura falhar", () => {
  // A função mora em estadia.ts: a tabela privada das instruções só é lida pelos leitores da estadia (guarda da chegada-e-pedido).
  const e = ler("src/lib/data/estadia.ts");
  const i = e.indexOf("export async function congelarInstrucaoSaida");
  assert.ok(i > 0);
  const corpo = e.slice(i, i + 900);
  assert.match(corpo, /\.is\("instrucao_saida", null\)/);
  assert.match(corpo, /catch/);
  const a = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.match(a, /import \{ congelarInstrucaoSaida \} from "@\/lib\/data\/estadia";/);
  assert.match(a, /await congelarInstrucaoSaida\(/);
  assert.doesNotMatch(a, /imovel_instrucoes_chegada/);
  // o guia lê a cópia do contrato junto das instruções
  assert.match(e, /select\("instrucao_saida"\)\.eq\("id", c\.id\)/);
});

test("migração 0320: aditiva, idempotente, só colunas novas, registrada e com rollback; nada na tabela pública do imóvel", () => {
  const mig = ler("supabase/migrations/0320_instrucao_saida_e662.sql");
  const ap = ler("supabase/producao/aplicar-0320.sql");
  assert.ok(existsSync(new URL("supabase/producao/rollback/0320_rollback.sql", raiz)));
  for (const t of [mig, ap]) {
    assert.match(t, /alter table public\.imovel_instrucoes_chegada\s+add column if not exists instrucao_saida text check/);
    assert.match(t, /alter table public\.contratos\s+add column if not exists instrucao_saida text check/);
    assert.doesNotMatch(t, /alter table (public\.)?properties/i);
    assert.doesNotMatch(t, /grant select \(instrucao_saida\) on public\.properties/i);
    assert.doesNotMatch(t, /drop |delete from|truncate/i);
  }
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /insert into supabase_migrations\.schema_migrations[\s\S]*0320_instrucao_saida_e662[\s\S]*where not exists/);
  assert.match(ler("supabase/producao/rollback/0320_rollback.sql"), /drop column if exists instrucao_saida/);
});
