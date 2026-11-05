/*
  Varredura de erros (rodada 23): falha de leitura não vira "nada", "não existe" nem "você ainda não é".
  Achado 124: Admin › Parceiros — os contadores (ativos por tipo e números do cartão do parceiro) liam sem olhar o erro
    e mostravam 0 na falha. Agora a falha lança e cai no aviso do admin ("Tentar de novo"), como as filas (Achado 18).
  Achado 125: Parceiro › Avaliação — a falha ao ler o parceiro ou o credenciamento virava "ainda não credenciado" e
    oferecia começar de novo (pedido duplicado). Agora lança e cai no aviso do painel.
  Achado 126: /imoveis-perto-de/[slug] — a falha ao ler o destino virava 404 ("página não existe") numa página pública
    indexada. Agora lança e cai no aviso de erro do site; 404 só quando o destino de fato não existe.
  Achado 127: /dashboard/imoveis/[id]/publicar — a falha ao ler o anúncio mandava o dono para a lista de imóveis, como
    se o anúncio não existisse. Agora lança e cai no aviso do painel.
  Roda: node --test src/lib/data/achado124-127-leituras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Achado 124: contadores do Admin › Parceiros lançam na falha (nunca 0 falso)", () => {
  const s = ler("app/(dashboard)/admin/parceiros/page.tsx");
  assert.match(s, /const \{ data: todosParceiros, error: erroTodos \} = await admin\.from\("parceiros"\)\.select\("id, categorias"\)\.limit\(5000\);/);
  assert.match(s, /if \(erroTodos\) throw new Error/);
  assert.match(s, /if \(\[cartoesP, pedidosP, donosP, testesP\]\.some\(\(r\) => r\.error\)\) throw new Error/);
});

test("Achado 125: Parceiro › Avaliação lança na falha do parceiro e do credenciamento", () => {
  const s = ler("app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(s, /const \{ data: parc, error: erroParc \} = await admin\.from\("parceiros"\)/);
  assert.match(s, /if \(erroParc\) throw new Error/);
  assert.match(s, /const \{ data: credLinhas, error: erroCred \} = await admin/);
  assert.match(s, /if \(erroCred\) throw new Error/);
});

test("Achado 126: /imoveis-perto-de lança na falha; 404 só sem destino", () => {
  const s = ler("app/(public)/imoveis-perto-de/[slug]/page.tsx");
  assert.match(s, /const \{ data: d, error \} = await admin\.from\("destinos"\)/);
  assert.match(s, /if \(error\) throw new Error/);
});

test("Achado 127: /publicar lança na falha em vez de mandar para a lista", () => {
  const s = ler("app/(dashboard)/dashboard/imoveis/[id]/publicar/page.tsx");
  assert.match(s, /const \{ data, error \} = await supabase\.from\("properties"\)\.select\("id, status"\)/);
  assert.match(s, /if \(error\) throw new Error/);
});
