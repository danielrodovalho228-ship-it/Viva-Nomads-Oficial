/*
  E567 (família E556/E557): um percentual por anúncio em todas as telas, e anúncio ATIVO sem "% completo".
  Roda: node --test src/lib/anuncio/e567-percentual-unico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blocoPrincipalDono } from "../painel/inicio-dono.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("Início, Meus imóveis e o editor leem a prontidão pela mesma fonte (com a qualificação do rascunho)", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/page.tsx"), /prontidaoDosImoveis\(supabase, user\.id, properties\.map\(\(p\) => p\.id\), \{ qualificacaoDoRascunho: true \}\)/);
  assert.match(ler("src/lib/data/actions.ts"), /fatosDosImoveis\(supabase, user\.id, \[data\.id as string\], \{ qualificacaoDoRascunho: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/page.tsx"), /fatosDosImoveis\(supabase, user\.id, \[id\], \{ qualificacaoDoRascunho: true \}\)/);
});

test("anúncio ativo não mostra '% completo': nem no cartão de Meus imóveis, nem no texto ou na barra do editor", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /!demoItem && comp && !imovelPublicado\(p\) && \(/);
  const ed = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(ed, /\{publicado \? "Anúncio publicado" :/);
  assert.match(ed, /\{!publicado && \(\n\s*<div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" data-testid="prontidao-barra">/);
});

test("o '% pronto' do Início diz de qual anúncio é (o nome do rascunho)", () => {
  const b = blocoPrincipalDono({
    rascunho: { id: "r1", pct: 50, pronto: false, itens: [{ label: "Fotos", ok: false, href: "/x" }], foto: null, nome: "[TESTE QA] Studio no Santa Mônica" },
    decisoes: [],
    temAnuncio: true,
    fotoAnuncio: null,
  } as Parameters<typeof blocoPrincipalDono>[0]);
  assert.equal(b.tipo, "rascunho");
  assert.equal(b.pct, 50);
  assert.equal(b.nome, "[TESTE QA] Studio no Santa Mônica");
  assert.match(ler("src/components/painel/inicio-dono.tsx"), /data-testid="inicio-dono-nome"/);
  assert.match(ler("src/app/(dashboard)/dashboard/inicio-dados.tsx"), /nome: draft\?\.title \?\? null,/);
});
