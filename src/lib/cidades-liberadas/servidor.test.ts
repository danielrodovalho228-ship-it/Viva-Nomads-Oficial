import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anotarInteresseDoDono, bloqueioPorCidade } from "./servidor.ts";

type Linha = { uf: string; chave: string; cidade: string; liberada: boolean; liberada_em: null; observacao: null };
const linhas: Linha[] = [{ uf: "MG", chave: "uberlandia", cidade: "Uberlândia", liberada: true, liberada_em: null, observacao: null }];

function falso(opts: { erro?: boolean; gravados?: unknown[] } = {}): SupabaseClient {
  const consulta = {
    select: () => consulta,
    order: () => consulta,
    limit: () => Promise.resolve(opts.erro ? { data: null, error: { message: "relation does not exist" } } : { data: linhas, error: null }),
    upsert: (linha: unknown) => {
      opts.gravados?.push(linha);
      return Promise.resolve({ error: null });
    },
  };
  return { from: () => consulta } as unknown as SupabaseClient;
}

test("publicar em cidade liberada passa; em cidade fechada devolve o convite", async () => {
  assert.equal(await bloqueioPorCidade(falso(), "Uberlandia"), null);
  assert.equal(await bloqueioPorCidade(falso(), "Goiânia"), "A Viva ainda não chegou em Goiânia. Deixe seu interesse e avisamos quando abrir.");
  assert.match((await bloqueioPorCidade(falso(), "  ")) ?? "", /ainda não chegou/);
});

test("sem a tabela (migração não aplicada) a publicação não é barrada", async () => {
  assert.equal(await bloqueioPorCidade(falso({ erro: true }), "Goiânia"), null);
});

test("interesse do dono só é gravado quando a UF é inequívoca", async () => {
  const municipios = { GO: ["Goiânia"], MG: ["Uberlândia"], PR: ["Santa Helena"], SC: ["Santa Helena"] };
  const gravados: unknown[] = [];
  await anotarInteresseDoDono(falso({ gravados }), "u1", "goiania", municipios);
  assert.deepEqual(gravados, [{ user_id: "u1", uf: "GO", chave: "goiania", cidade: "Goiânia", papel: "proprietario" }]);
  await anotarInteresseDoDono(falso({ gravados }), "u1", "Santa Helena", municipios);
  await anotarInteresseDoDono(falso({ gravados }), "u1", "Lugar Nenhum", municipios);
  assert.equal(gravados.length, 1);
});

test("createProperty e updateProperty barram cidade fechada no servidor, antes de publicar", () => {
  const src = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  const criar = src.slice(src.indexOf("export async function createProperty"), src.indexOf("export async function loadPropertyForEdit"));
  assert.ok(criar.indexOf("cidadeFechada(supabase, user.id, input.city)") > 0);
  assert.ok(criar.indexOf("cidadeFechada(") < criar.indexOf('.from("properties")\n    .insert('));
  const editar = src.slice(src.indexOf("export async function updateProperty"), src.indexOf("export async function toggleFavorite"));
  assert.ok(editar.indexOf("cidadeFechada(") > 0);
  assert.ok(editar.indexOf("cidadeFechada(") < editar.indexOf('status: "active", draft_data: null'));
});

test("migração 0159: leitura pública, escrita admin, seed só Uberlândia, e produção registra a versão", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0159_cidades_liberadas.sql", import.meta.url), "utf8");
  assert.match(sql, /cidades_liberadas_leitura[\s\S]*to anon, authenticated using \(true\)/);
  assert.match(sql, /cidades_liberadas_admin[\s\S]*public\.is_admin\(\)/);
  assert.match(sql, /interesse_cidade_proprio_insere[\s\S]*user_id = \(select auth\.uid\(\)\)/);
  assert.equal((sql.match(/insert into public\.cidades_liberadas/g) ?? []).length, 1);
  assert.match(sql, /values \('MG', 'uberlandia'/);
  const prod = readFileSync(new URL("../../../supabase/producao/aplicar-0159.sql", import.meta.url), "utf8");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /commit;\s*$/);
  assert.match(prod, /'20261018000159', '0159_cidades_liberadas'/);
});
