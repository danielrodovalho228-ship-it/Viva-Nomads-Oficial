/* Roda: node --test src/lib/e308-causa-raiz.test.ts — E308 (causa raiz, 01/11): capas de rascunho com imagem quebrada.
   Em produção, 37 linhas de foto de 7 rascunhos apontavam para arquivos já apagados do bucket; 11 desses arquivos eram
   usados por 3 imóveis ao mesmo tempo e saíram quando UM deles tirou a foto. Correção: (1) o arquivo só sai do bucket
   se nenhum imóvel/rascunho ainda o usa — na sincronização, na exclusão e no "remover" do cadastro (agora pelo
   servidor); (2) a capa (Início e Meus imóveis) só usa foto cujo arquivo existe. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caminhoNoBucketFotos, capaDoDraftData, soFotosExistentes } from "./fotos-anuncio.ts";

const DONO = "11111111-2222-3333-4444-555555555555";
const url = (arq: string) => `https://x.supabase.co/storage/v1/object/public/property-photos/${DONO}/${arq}`;
const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("caminho no bucket a partir da URL pública", () => {
  assert.equal(caminhoNoBucketFotos(url("a.webp")), `${DONO}/a.webp`);
  assert.equal(caminhoNoBucketFotos(url("a.webp") + "?v=2"), `${DONO}/a.webp`);
  assert.equal(caminhoNoBucketFotos("https://outro.com/a.webp"), null);
  assert.equal(caminhoNoBucketFotos(url("../b.webp")), null);
});

test("só as fotos cujo arquivo existe; sem conferência possível, nada é filtrado", () => {
  const existentes = new Set([`${DONO}/b.webp`]);
  assert.deepEqual(soFotosExistentes([url("a.webp"), url("b.webp")], existentes), [url("b.webp")]);
  assert.deepEqual(soFotosExistentes([url("a.webp")], null), [url("a.webp")]);
  assert.deepEqual(soFotosExistentes(["https://outro.com/c.webp"], existentes), ["https://outro.com/c.webp"]);
});

test("capa pelo draft_data pula o arquivo que já saiu do bucket", () => {
  const data = { photos: [{ url: url("apagada.webp") }, { url: url("viva.webp") }] };
  assert.equal(capaDoDraftData(data, DONO, new Set([`${DONO}/viva.webp`])), url("viva.webp"));
  assert.equal(capaDoDraftData(data, DONO, new Set()), null);
  assert.equal(capaDoDraftData(data, DONO), url("apagada.webp"));
});

test("o arquivo só sai do bucket se nenhum imóvel ou rascunho ainda o usa", () => {
  const m = ler("./minimizacao/fotos-anuncio.ts");
  assert.match(m, /export async function caminhosAindaUsados/);
  assert.match(m, /from\("property_photos"\)\.select\("property_id"\)\.like\("url"/);
  assert.match(m, /\.contains\("draft_data", \{ photos: \[\{ url \}\] \}\)/);
  const corpo = m.slice(m.indexOf("export async function apagarFotosDoAnuncio"));
  assert.ok(corpo.indexOf("caminhosAindaUsados") < corpo.indexOf(".remove(caminhos)"));
});

test("o 'remover' do cadastro passa pelo servidor (não apaga direto do navegador)", () => {
  const st = ler("./data/storage.ts");
  const fn = st.slice(st.indexOf("export async function removePropertyPhoto"), st.indexOf("export const PROPERTY_DOCS_BUCKET"));
  assert.doesNotMatch(fn, /storage\.from\(PROPERTY_PHOTOS_BUCKET\)\.remove/);
  assert.match(fn, /removerFotoDoCadastro\(path\)/);
  const acao = ler("./data/fotos-cadastro-actions.ts");
  assert.match(acao, /^"use server";/);
  assert.match(acao, /path\.startsWith\(`\$\{user\.id\}\/`\)/);
  assert.match(acao, /apagarFotosDoAnuncio\(createAdminClient\(\)/);
});

test("as capas (Início e Meus imóveis) conferem se o arquivo existe", () => {
  assert.match(ler("../app/(dashboard)/dashboard/page.tsx"), /arquivosDoDono\(createAdminClient\(\), user\.id\)[\s\S]*soFotosExistentes/);
  assert.match(ler("./data/properties.ts"), /const existentes = await arquivosDoDono\(createAdminClient\(\), user\.id\);\n\s*for \(const p of lista\) if \(p\.photos\?\.length\) p\.photos = soFotosExistentes\(p\.photos, existentes\);/);
});
