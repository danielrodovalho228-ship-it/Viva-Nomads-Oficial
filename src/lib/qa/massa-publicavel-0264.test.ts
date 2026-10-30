/*
  0264 — E273/E275: rascunhos 100% publicáveis pelo editor e com código público próprio.
  Roda: node --test src/lib/qa/massa-publicavel-0264.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codigoDoImovel } from "../imovel-pagina.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const IDS = ["a0264a00-0000-4000-8000-000000000001", "a0264b00-0000-4000-8000-000000000001"];

test("E275: os dois anúncios da massa têm códigos públicos diferentes (os 0263 repetiam VN-A02630)", () => {
  assert.notEqual(codigoDoImovel(IDS[0]), codigoDoImovel(IDS[1]));
  assert.deepEqual(IDS.map(codigoDoImovel), ["VN-A0264A", "VN-A0264B"]);
  assert.equal(codigoDoImovel("a0263000-0000-4000-8000-000000000001"), codigoDoImovel("a0263000-0000-4000-8000-000000000002"));
});

test("E273: o rascunho nasce com tudo o que o editor confere (rascunho E colunas)", () => {
  const mig = ler("supabase/migrations/0264_qa_rascunhos_publicaveis.sql");
  const aplicar = ler("supabase/producao/aplicar-0264.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    for (const id of IDS) assert.ok(sql.includes(id), id);
    // Endereço completo no rascunho e nas colunas.
    assert.match(sql, /'street', 'Avenida Ana Godoy de Sousa', 'numero', v_numero, 'complemento', '', 'cep', '38408-290'/);
    assert.match(sql, /'Avenida Ana Godoy de Sousa, ' \|\| v_numero, '38408290', -18\.909872/);
    // Garantia, faixa, disponibilidade, Passo 10 e descrição na coluna.
    assert.match(sql, /'garantias', jsonb_build_object\('caucao_avista', true/);
    assert.match(sql, /array\['media_estadia'\], array\['caucao_avista'\]/);
    assert.match(sql, /'availableFrom', '2026-11-01'/);
    assert.match(sql, /'declaracoesPasso10', jsonb_build_object\('iptuOk', true, 'habitavel', true, 'convencao', 'yes'\)/);
    assert.match(sql, /values \(v_imovel, v_dono, 'draft', v_titulo, v_dados->>'description'/);
    // Padrão mínimo: os 12 itens da lista v2, confirmados.
    const itens = /c_conforto constant text\[\] := array\[([\s\S]*?)\];/.exec(sql)![1].match(/'[a-z_]+'/g)!;
    assert.equal(itens.length, 12);
    assert.match(sql, /select v_imovel, c, true, v_dono, now\(\), 2 from unnest\(c_conforto\)/);
    // Compatível com o pedido da prova: 2 quartos, 3.200 + 150 ≤ 4.000.
    assert.match(sql, /2, 1, 4, 62,\s*1, 3200, 'fixed', 150, 30, 180,/);
    // Nunca publica nem toca pedidos, automações ou o D-5; repetir não duplica.
    assert.doesNotMatch(sql, /'active'|pedidos_moradia|emails_proativos|automacoes|d5d50247|update public\./i);
    assert.match(sql, /continue when exists \(select 1 from public\.properties where id = v_imovel\);/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261030000264', '0264_qa_rascunhos_publicaveis'/);
  const volta = ler("supabase/producao/rollback/0264_rollback.sql");
  assert.match(volta, /delete from public\.properties where id in \('a0264a00-0000-4000-8000-000000000001', 'a0264b00-0000-4000-8000-000000000001'\);/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000264';/);
  assert.doesNotMatch(volta, /storage\./);
  assert.match(ler("docs/qa-receita-rascunho-publicavel.md"), /6 primeiros caracteres do id/);
});
