/* Roda: node --test src/lib/painel/contadores-home-morador.test.ts — E181: os contadores da home do morador = as listas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Favoritos e Buscas salvas contam as MESMAS listas das telas de destino (nunca um número fixo)", () => {
  const home = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.doesNotMatch(home, /label="Favoritos" value=\{demo \? "3" : "0"\}/);
  assert.doesNotMatch(home, /label="Buscas salvas" value=\{demo \? "2" : "0"\}/);
  // Favoritos: a lista de /dashboard/favoritos (useFavoritos — os favoritados que existem).
  assert.match(home, /const \{ favoritos \} = useFavoritos\(\);/);
  assert.match(home, /label="Favoritos" value=\{demo \? "3" : String\(favoritos\.length\)\}/);
  assert.match(ler("app/(dashboard)/dashboard/favoritos/page.tsx"), /useFavoritos\(\)/);
  // Buscas salvas: a lista de /dashboard/buscas (listarBuscasSalvas), lida no servidor.
  assert.match(home, /label="Buscas salvas" value=\{demo \? "2" : String\(totalBuscasSalvas\)\}/);
  const pagina = ler("app/(dashboard)/dashboard/page.tsx");
  assert.match(pagina, /listarBuscasSalvas\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pagina, /totalBuscasSalvas=\{buscasSalvas\.length\}/);
  assert.match(ler("app/(dashboard)/dashboard/buscas/page.tsx"), /listarBuscasSalvas/);
});

test("E181: a lista de favoritos da conta chega ao aparelho no login (o contador e a lista leem a mesma fonte)", () => {
  const mescla = readFileSync("src/lib/convidado/mesclar.ts", "utf8");
  assert.match(mescla, /const carregarConta = fav\.owner === userId && contaCarregada !== userId;/);
  assert.match(mescla, /if \(pendentes\.length \|\| carregarConta\)/);
});

test("E181 (família inteira): Candidaturas e Mensagens da home também contam a MESMA função das telas de destino", () => {
  const home = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  const pagina = ler("app/(dashboard)/dashboard/page.tsx");
  // Candidaturas: listMinhasCandidaturas, na home e em /dashboard/candidaturas.
  assert.match(pagina, /listMinhasCandidaturas\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pagina, /totalCandidaturas=\{candidaturas\.length\}/);
  assert.match(ler("app/(dashboard)/dashboard/candidaturas/page.tsx"), /listMinhasCandidaturas\(\)/);
  assert.match(home, /label="Candidaturas" value=\{demo \? "2" : String\(totalCandidaturas\)\}/);
  // Mensagens: listConversations, na home e em /dashboard/mensagens (a tela abre em "Todas").
  assert.match(pagina, /listConversations\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pagina, /totalConversas=\{conversas\.length\}/);
  assert.match(ler("app/(dashboard)/dashboard/mensagens/page.tsx"), /initial=\{await listConversations\(\)\}/);
  assert.match(ler("app/(dashboard)/dashboard/mensagens/messages-client.tsx"), /useState<Filtro>\("todas"\)/);
  assert.match(home, /label="Mensagens" value=\{demo \? "1" : String\(totalConversas\)\}/);
  // Nenhum contador do morador com número fixo fora do modo demonstração.
  for (const rotulo of ["Candidaturas", "Favoritos", "Buscas salvas", "Mensagens"]) {
    assert.doesNotMatch(home, new RegExp(`label="${rotulo}" value=\\{demo \\? "\\d+" : "\\d+"\\}`), rotulo);
  }
});
