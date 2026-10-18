/*
  Ordem 04e2fe5e, item 5 — termo de aceite do anúncio feito com IA.
  Roda: node --test src/lib/anuncio/termo-ia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TERMO_IA_VERSAO, TERMO_IA_TEXTO, aceiteDoEditor, camposDaIa, validarAceiteIa } from "./termo-ia.ts";

test("o texto do termo diz que a IA pode errar e que a responsabilidade é do dono", () => {
  assert.match(TERMO_IA_TEXTO, /inteligência artificial pode errar/);
  assert.match(TERMO_IA_TEXTO, /responsável pelo que está no anúncio/);
});

test("aceite válido guarda a versão e as listas de campos", () => {
  const r = validarAceiteIa({ versao: TERMO_IA_VERSAO, camposGeradosIa: ["title", "description"], camposEditados: ["title"] });
  assert.deepEqual(r, { ok: true, aceite: { versao: TERMO_IA_VERSAO, camposGeradosIa: ["title", "description"], camposEditados: ["title"] } });
});

test("sem aceite, versão antiga ou lixo no lugar do objeto: recusa", () => {
  for (const x of [undefined, null, "sim", 1, [], {}, { versao: "1999-01-01", camposGeradosIa: [], camposEditados: [] }]) {
    assert.equal(validarAceiteIa(x).ok, false);
  }
});

test("campo desconhecido ou lista enorme: recusa; repetidos são unificados", () => {
  assert.equal(validarAceiteIa({ versao: TERMO_IA_VERSAO, camposGeradosIa: ["owner_id"], camposEditados: [] }).ok, false);
  assert.equal(validarAceiteIa({ versao: TERMO_IA_VERSAO, camposGeradosIa: new Array(50).fill("title"), camposEditados: [] }).ok, false);
  const r = validarAceiteIa({ versao: TERMO_IA_VERSAO, camposGeradosIa: ["title", "title"], camposEditados: [] });
  assert.ok(r.ok && r.aceite.camposGeradosIa.length === 1);
});

test("camposDaIa: sem IA nada é gerado; com IA, editado = texto diferente do original", () => {
  assert.deepEqual(camposDaIa({ geradoPorIa: false, titulo: "a", descricao: "b" }), { camposGeradosIa: [], camposEditados: [] });
  assert.deepEqual(camposDaIa({ geradoPorIa: true, titulo: "a", descricao: "b", original: { titulo: "a", descricao: "b" } }), {
    camposGeradosIa: ["title", "description"],
    camposEditados: [],
  });
  assert.deepEqual(camposDaIa({ geradoPorIa: true, titulo: "a2", descricao: "b", original: { titulo: "a", descricao: "b" } }).camposEditados, ["title"]);
});

test("a publicação exige o aceite no servidor e a tela exige a caixa marcada", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
  const actions = ler("lib/data/actions.ts");
  assert.match(actions, /exigirAceiteIa/);
  const pagina = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"), /data-testid="aceite-ia"/);
  assert.match(pagina, /podePublicar = prontidao\.podePublicar && qualificado && aceitouIa/);
});

test("a migração do aceite é idempotente, só com RLS do dono e sem update/delete", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0103_aceites_ia.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.anuncio_aceites_ia/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /grant[^;]*(update|delete)[^;]*to authenticated/i);
});

test("editor: aceiteDoEditor só devolve o aceite com a caixa marcada; texto do editor não conta como gerado por IA", () => {
  assert.equal(aceiteDoEditor(false), undefined);
  const a = validarAceiteIa(aceiteDoEditor(true));
  assert.ok(a.ok);
  assert.deepEqual(a.aceite, { versao: TERMO_IA_VERSAO, camposGeradosIa: [], camposEditados: [] });
});

test("editor: anúncio que nasceu com descrição da IA mantém 'description' como gerada (e editada se mudou)", () => {
  const base = { descricaoGeradaPorIa: true, descricao: "texto IA", descricaoOriginal: "texto IA" };
  assert.deepEqual(aceiteDoEditor(true, base), { versao: TERMO_IA_VERSAO, camposGeradosIa: ["description"], camposEditados: [] });
  assert.deepEqual(aceiteDoEditor(true, { ...base, descricao: "meu texto" })?.camposEditados, ["description"]);
  assert.ok(validarAceiteIa(aceiteDoEditor(true, base)).ok);
  // negativo: sem a origem IA ou sem a caixa, nada de campo gerado
  assert.deepEqual(aceiteDoEditor(true, { ...base, descricaoGeradaPorIa: false })?.camposGeradosIa, []);
  assert.equal(aceiteDoEditor(false, base), undefined);
});

test("o editor repassa a origem IA do imóvel ao salvar (senão o salvamento zera descricao_gerada_por_ia)", () => {
  const editor = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), "utf8");
  assert.match(editor, /descricaoGeradaPorIa: property\.descricaoGeradaPorIa/);
});

test("o editor por seções mostra a caixa do termo e envia o aceite só ao publicar", () => {
  const editor = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), "utf8");
  assert.match(editor, /data-testid="aceite-ia"/);
  assert.match(editor, /TERMO_IA_TEXTO/);
  assert.match(editor, /asDraft === false\s*\?\s*aceiteDoEditor\(aceitouIa,/);
  assert.match(editor, /aceitouIa/);
});
