/*
  Varredura de erros (rodada 25): falha de leitura dos parceiros não vira "nenhum parceiro" nem "página não encontrada".
  Achado 131: busca pública de parceiros — a falha ao ler a lista virava lista vazia ("Nenhum parceiro em <cidade>" e,
    pior, o "Parceiro geral da Viva" no lugar). Agora o resultado traz `falhou`; as páginas avisam e oferecem "Tentar de novo".
  Achado 132: página pública do parceiro — a falha virava 404 ("não encontrado"), e os serviços/galeria que falhavam
    sumiam calados. Agora lança (a tela de erro com código aparece), nunca um 404 que o buscador guardaria.
  Achado 133: troca automática de parceiro e opções do imóvel — a falha da busca virava "não há outro parceiro" (a troca
    desistia sem dizer) ou "nenhuma opção" (o dono convidaria de novo). Agora a troca recusa ANTES de cancelar o pedido
    atual e as opções lançam, como as outras leituras desta tela (Achado 99).
  Roda: node --test src/lib/data/achado131-133-parceiros-publicos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Achado 131: buscarParceiros devolve `falhou` quando a leitura da lista dá erro", () => {
  const s = ler("src/lib/data/parceiros-publico.ts");
  assert.match(s, /\/\*\* Achado 131:[^*]*\*\/\s*falhou: boolean;/);
  assert.match(s, /const \{ data, error \} = await sb\.from\("parceiros_publicos"\)\.select\("\*"\)\.limit\(500\);/);
  assert.match(s, /if \(error\) return \{ lista: \[\], cidade, uf, cep, cepNaoEncontrado: !!cep && !doCep, comNota: 0, falhou: true \};/);
  // sucesso nunca marca falha
  assert.match(s, /return \{ lista, cidade, uf, cep, cepNaoEncontrado: !!cep && !doCep, comNota, falhou: false \};/);
});

test("Achado 131: as duas páginas públicas avisam a falha e não oferecem o 'Parceiro geral' no lugar", () => {
  const b = ler("src/app/(public)/parceiros/buscar/page.tsx");
  assert.match(b, /const geral = r\.lista\.length \|\| r\.falhou \? null : await lerParceiroGeralServidor\(\);/);
  assert.match(b, /r\.falhou \? \(/);
  assert.match(b, /data-testid="busca-parceiros-falhou"/);
  assert.match(b, /data-testid="busca-parceiros-tentar-de-novo"/);
  const f = ler("src/app/(public)/parceiros/fotografos/page.tsx");
  assert.match(f, /const geral = cidade && !fotografos\.length && !r\.falhou \? await lerParceiroGeralServidor\(\) : null;/);
  assert.match(f, /data-testid="fotografos-falhou"/);
  assert.match(f, /data-testid="fotografos-tentar-de-novo"/);
});

test("Achado 132: a página do parceiro lança na falha de leitura (perfil, serviços e galeria)", () => {
  const s = ler("src/lib/data/parceiros-publico.ts");
  const fn = s.slice(s.indexOf("export async function parceiroPorSlug"));
  assert.match(fn, /const \{ data, error \} = await sb\.from\("parceiros_publicos"\)\.select\("\*"\)\.eq\("slug", slug\)\.maybeSingle\(\);/);
  assert.match(fn, /if \(error\) throw new Error\(MSG_PARCEIRO_NAO_ABRIU\);/);
  assert.match(fn, /const \[\{ data: sv, error: erroSv \}, \{ data: gl, error: erroGl \}\] = await Promise\.all/);
  assert.match(fn, /if \(erroSv \|\| erroGl\) throw new Error\(MSG_PARCEIRO_NAO_ABRIU\);/);
});

test("Achado 133: a troca de parceiro recusa a falha da busca antes de cancelar; as opções do imóvel lançam", () => {
  const a = ler("src/lib/automacao/acoes.ts");
  assert.match(a, /const busca = await buscarParceiros\(\{ categoria: p\.categoria, cidade: \(im as \{ city: string \| null \} \| null\)\?\.city \?\? null \}\);\s*\n(?:\s*\/\/[^\n]*\n)?\s*if \(busca\.falhou\) return \{ ok: false, erro: "Não foi possível trocar o parceiro agora\. Tente de novo\." \};/);
  assert.ok(a.indexOf("if (busca.falhou)") < a.indexOf('status: "cancelado"', a.indexOf("if (busca.falhou)")), "recusa antes do cancelamento");
  assert.match(a, /const resultados = await Promise\.all\(faltam\.map\(\(c\) => buscarParceiros\(\{ categoria: c, cidade: im\.city \}\)\)\);\s*\n(?:\s*\/\/[^\n]*\n)?\s*if \(resultados\.some\(\(r\) => r\.falhou\)\) throw new Error\("Não foi possível ler os parceiros do imóvel\."\);/);
});
