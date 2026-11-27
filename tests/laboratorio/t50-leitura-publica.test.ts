import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Toda tabela que uma migração abre para o papel anon por uma policy *_le_publico precisa estar em
// LEITURA_PUBLICA do t50; senão o laboratório acusa "anon leu linha" numa leitura que é de propósito
// (t50, lab de 22/10: parceiro_galeria).
test("t50: tabelas de parceiro com policy _le_publico estão em LEITURA_PUBLICA", () => {
  const spec = readFileSync("tests/e2e/specs/t50-rls-todas-tabelas.spec.ts", "utf8");
  const lista = spec.match(/LEITURA_PUBLICA = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const migracao = readFileSync("supabase/migrations/0190_parceiros_ciclo.sql", "utf8");
  const tabelas = migracao.match(/foreach t in array array\[([^\]]+)\]/i)?.[1].match(/parceiro_[a-z_]+/g) ?? [];
  assert.ok(tabelas.length >= 3, "a migração 0190 abre as tabelas de parceiro para anon");
  for (const t of tabelas) assert.ok(lista.includes(`"${t}"`), `${t} falta em LEITURA_PUBLICA`);
});

/*
  E1001 (Gerente, 17/11/2026) — a t50 ficou vermelha todas as noites desde o #3875 (E604, 16/11): a semente do laboratório
  passou a dar comodidade a todo anúncio publicado e extras ao imóvel 1, e o visitante lê essas linhas por desenho.
  Julgamento do Gerente: property_amenities, imovel_extras e imovel_ruido entram na leitura pública — "são dados de
  exibição pública do anúncio (comodidades e extras na página do imóvel; classe de ruído alimenta o filtro público de
  ambiente silencioso). O lado negativo da asserção — tudo o resto negado — fica intocado."
*/
const specT50 = () => readFileSync("tests/e2e/specs/t50-rls-todas-tabelas.spec.ts", "utf8");
const listaT50 = () => [...(specT50().match(/LEITURA_PUBLICA = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "").matchAll(/^\s*(?!\/\/)(.*)$/gm)].flatMap((l) => [...l[1].matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));

test("E1001: as três tabelas de exibição do anúncio estão em LEITURA_PUBLICA, e só anúncio ATIVO é lido pelo visitante", () => {
  const lista = listaT50();
  for (const t of ["property_amenities", "imovel_extras", "imovel_ruido"]) assert.ok(lista.includes(t), `${t} falta em LEITURA_PUBLICA`);
  // A leitura do visitante é presa ao anúncio ativo pela própria policy (rascunho e pausado ficam de fora).
  const m0018 = readFileSync("supabase/migrations/0018_property_enrichment.sql", "utf8");
  assert.match(m0018, /create policy "amenidades públicas" on property_amenities for select using \(\s*exists \(select 1 from properties p where p\.id = property_id and \(p\.status = 'active' or p\.owner_id = auth\.uid\(\)\)\)/);
  const m0213 = readFileSync("supabase/migrations/0213_niveis_conforto.sql", "utf8");
  for (const [t, nome] of [["imovel_extras", "extras"], ["imovel_ruido", "ruido"]]) {
    assert.match(m0213, new RegExp(`create policy "${nome}: anuncio ativo" on public\\.${t} for select to anon using \\(\\s*exists \\(select 1 from public\\.properties p where p\\.id = ${t}\\.property_id and p\\.status::text = 'active'\\)`), `${t}: policy do visitante só para anúncio ativo`);
    assert.match(m0213, new RegExp(`revoke all on public\\.${t} from anon, authenticated;\\s*grant select on public\\.${t} to anon, authenticated;`), `${t}: o visitante só tem SELECT`);
  }
});

test("E1001: a lista de leitura pública é exatamente esta (nada mais entra sem decisão) e o lado negativo fica como estava", () => {
  assert.deepEqual(listaT50().sort(), [
    "cidades_liberadas", "cities", "faixas_assinatura", "faixas_comissao", "garantias", "imovel_extras", "imovel_nivel", "imovel_ruido",
    "parceiro_agenda", "parceiro_galeria", "parceiro_servicos", "planos", "plans", "properties", "property_amenities", "property_photos",
    "reviews", "servicos_adicionais",
  ]);
  const spec = specT50();
  // Fora da lista: nenhuma linha lida. Em TODA tabela (dentro ou fora da lista): nenhuma escrita anônima.
  assert.match(spec, /if \(!LEITURA_PUBLICA\.has\(t\)\) \{\s*expect\(sel\.data \?\? \[\], `anon leu linha de \$\{t\}`\)\.toHaveLength\(0\);/);
  for (const acao of ["inseriu em", "atualizou", "apagou de"]) assert.match(spec, new RegExp(`expect\\(\\w+\\.data \\?\\? \\[\\], \`anon ${acao} \\$\\{t\\}\`\\)\\.toHaveLength\\(0\\);`));
  assert.doesNotMatch(spec, /test\.(fixme|fail)\(/);
});
