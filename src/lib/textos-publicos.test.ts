/* Roda: node --test src/lib/textos-publicos.test.ts
   Guarda de texto das páginas públicas (ordens do Otávio, pacote 12/10 tarde). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho: string) => readFileSync(new URL(`../../${caminho}`, import.meta.url), "utf8");

test("#67: /precos e /para-proprietarios não prometem seguro-fiança nem 'garante o aluguel'", () => {
  for (const f of ["src/app/(public)/precos/page.tsx", "src/app/(public)/para-proprietarios/page.tsx"]) {
    const t = ler(f);
    assert.doesNotMatch(t, /seguro-fian/i, f);
    assert.doesNotMatch(t, /garante o aluguel/i, f);
    assert.match(t, /não é a garantidora/, f);
    assert.match(t, /Outras modalidades de garantia locatícia: em breve/, f);
  }
});

test("#68: keywords globais e textos públicos sem 'aluguel' (fora de citações legais)", () => {
  const layout = ler("src/app/layout.tsx");
  assert.doesNotMatch(layout, /aluguel 30 dias/i);
  assert.match(layout, /locação mobiliada 30 a 180 dias/);
  for (const f of ["src/app/(public)/page.tsx", "src/app/(public)/para-proprietarios/page.tsx", "src/app/(public)/precos/page.tsx"]) {
    assert.doesNotMatch(ler(f), /\balugu?el\b/i, f);
  }
});

test("#69: aviso de testes único, no layout público, sem cópias nas páginas", async () => {
  const { AVISO_TESTES } = await import("./aviso-testes.ts");
  assert.equal(AVISO_TESTES, "Plataforma em fase de testes. Lançamento oficial em 2027.");
  assert.match(ler("src/app/(public)/layout.tsx"), /<AvisoTestes \/>/);
  assert.doesNotMatch(ler("src/app/(public)/layout.tsx"), /em pré-lançamento —/);
  for (const f of ["src/app/(public)/parceiros/page.tsx", "src/app/(public)/guia-fotos/page.tsx", "src/app/(public)/parceiros/fotografos/page.tsx"]) {
    assert.doesNotMatch(ler(f), /fase de testes/i, f);
    assert.doesNotMatch(ler(f), /RODAPE_GUIA/, f);
  }
});

test("#70: /parceiros/fotografos tem 'pedir é grátis' e botão para /parceiros", () => {
  const t = ler("src/app/(public)/parceiros/fotografos/page.tsx");
  assert.match(t, /Pedir é grátis: a Viva não cobra nada de você; o fotógrafo paga a taxa de parceria só quando aceita o pedido\./);
  assert.match(t, /href="\/parceiros"[^>]*>É fotógrafo\? Seja parceiro</);
});

test("#71: título de /parceiros sem marca repetida (≤ 60 com o sufixo) e frase do Plano Gestor", () => {
  const t = ler("src/app/(public)/parceiros/page.tsx");
  const titulo = /title: "([^"]+)"/.exec(t)?.[1] ?? "";
  assert.equal(titulo, "Seja parceiro: fotógrafos e gestores");
  assert.ok(`${titulo} · Viva Nomads`.length <= 60);
  assert.doesNotMatch(titulo, /Viva Nomads/);
  const p = ler("src/app/(public)/precos/page.tsx");
  assert.match(p, /31 imóveis ou mais\? Fale com a gente sobre o Plano Gestor\./);
  assert.doesNotMatch(p, /a conversa é direta/);
});

test("#74: /como-funciona sem seguradora parceira nem seguro-fiança; garantia é Caução", () => {
  const t = ler("src/app/(public)/como-funciona/page.tsx");
  assert.doesNotMatch(t, /seguradora parceira/i);
  assert.doesNotMatch(t, /seguro-fian/i);
  assert.match(t, /Combinada entre proprietário e inquilino\. A Viva não é garantidora\./);
});

test("#79: /seguranca com description ≤ 155 e BreadcrumbList nas 4 páginas, sem AggregateRating", () => {
  const desc = /description:\s*"([^"]+)"/.exec(ler("src/app/(public)/seguranca/page.tsx"))?.[1] ?? "";
  assert.ok(desc.length > 0 && desc.length <= 155, `description tem ${desc.length}`);
  for (const p of ["parceiros", "parceiros/fotografos", "guia-fotos", "seguranca"]) {
    const t = ler(`src/app/(public)/${p}/page.tsx`);
    assert.equal((t.match(/<JsonLd /g) ?? []).length, 1, p);
    assert.match(t, /trilha\(SITE_URL,/, p);
    assert.doesNotMatch(t, /AggregateRating/, p);
  }
});

test("#79: trilha() gera BreadcrumbList válido", async () => {
  const { trilha } = await import("./seo/estruturados.ts");
  const j = trilha("https://x.com.br", [{ nome: "Sua segurança", caminho: "/seguranca" }]);
  assert.equal(j["@type"], "BreadcrumbList");
  assert.deepEqual(j.itemListElement.map((i) => [i.position, i.item]), [[1, "https://x.com.br"], [2, "https://x.com.br/seguranca"]]);
  assert.doesNotMatch(JSON.stringify(j), /AggregateRating/);
});

/* F5 (QA do Daniel 12/10): nota interna nunca aparece em página pública. */
import { readdirSync, statSync } from "node:fs";

function paginasPublicas(dir: string): string[] {
  const base = new URL(`../../${dir}/`, import.meta.url);
  const out: string[] = [];
  for (const nome of readdirSync(base)) {
    const caminho = `${dir}/${nome}`;
    if (statSync(new URL(`../../${caminho}`, import.meta.url)).isDirectory()) out.push(...paginasPublicas(caminho));
    else if (nome === "page.tsx") out.push(caminho);
  }
  return out;
}

test("F5: páginas públicas sem nota interna ('aguardando revisão', Dra. Beatriz, Sérgio, TODO, em rascunho)", () => {
  const paginas = paginasPublicas("src/app/(public)");
  assert.ok(paginas.length > 10);
  for (const f of paginas) {
    // tira comentários (não aparecem na tela) antes de varrer
    const t = ler(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(t, /aguardando revis[ãa]o/i, f);
    assert.doesNotMatch(t, /Dra\. Beatriz/, f);
    assert.doesNotMatch(t, /S[ée]rgio/, f);
    assert.doesNotMatch(t, /\bTODO\b/, f);
    assert.doesNotMatch(t, /\bem rascunho\b/i, f);
  }
});

test("F5: /seguranca sem a frase cortada sobre corretagem/CRECI (até o parecer)", () => {
  const t = ler("src/app/(public)/seguranca/page.tsx");
  assert.doesNotMatch(t, /CRECI/);
  assert.doesNotMatch(t, /parecer jurídico em andamento/);
});

test("F4: comparativo de preços monta frases com números em uma só string (sem texto colado)", () => {
  const t = ler("src/components/precos/comparativo-precos.tsx");
  // texto + {expressão} lado a lado no JSX vira nós separados; o QA leu "de3meses aR$ 4.320por mês"
  assert.doesNotMatch(t, /Reserva de \{COMPARE_MESES\}/);
  assert.doesNotMatch(t, /^\s*, conferido em \{/m);
  assert.match(t, /`Reserva de \$\{COMPARE_MESES\} meses a \$\{reaisInteiros\(COMPARE_ALUGUEL\)\} por mês/);
  assert.match(t, /`, conferido em \$\{dataBR\(l\.conferidoEm\)\}`/);
});
