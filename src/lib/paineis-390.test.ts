import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("D3: 'Meus imóveis' do proprietário põe os selos abaixo do título (390 px)", () => {
  const f = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  const lista = f.slice(f.indexOf('<Panel title="Meus imóveis">'), f.indexOf('<Panel title="Atividade recente">'));
  assert.match(lista, /line-clamp-2/, "título limitado a 2 linhas");
  assert.match(lista, /h-14 w-14 shrink-0/, "miniatura com largura fixa");
  const iTitulo = lista.indexOf("{p.title}");
  const iSelo = lista.indexOf("<ReadyToLiveBadge />");
  assert.ok(iTitulo > 0 && iSelo > iTitulo, "selos vêm depois do título");
  assert.doesNotMatch(lista, /justify-between gap-3 py-3/, "sem linha em duas pontas que espreme o título");
});

test("D4: aviso final da Verificação é um bloco de texto único, não colunas", () => {
  const f = ler("src/app/(dashboard)/dashboard/verificacao/page.tsx");
  const i = f.indexOf("<Lock className");
  const bloco = f.slice(i, f.indexOf("</p>", i));
  assert.match(bloco, /<span className="min-w-0">/, "texto embrulhado em um único filho do flex");
});

test("D6: conteúdo dos painéis reserva espaço inferior para o botão da Viva (celular)", () => {
  const f = ler("src/components/layout/dashboard-shell.tsx");
  const main = f.slice(f.indexOf("<main"), f.indexOf(">", f.indexOf("<main")));
  assert.match(main, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(main, /sm:p-8/, "no computador o padding volta ao normal");
});

test("D2: a visão geral tem h1 (Prompt 42: o título em texto do PageTitle, sem a faixa de boas-vindas)", () => {
  const f = ler("src/components/dashboard/primitives.tsx");
  const titulo = f.slice(f.indexOf("export function PageTitle"), f.indexOf("export function StatCard"));
  assert.match(titulo, /<h1 /);
  assert.doesNotMatch(titulo, /<h2 /);
  assert.match(ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx"), /<PageTitle/);
});

test("D5: Favoritos, Comparações e Buscas salvas mostram o título antes das abas", () => {
  for (const r of ["favoritos", "comparar", "buscas"]) {
    const f = ler(`src/app/(dashboard)/dashboard/${r}/page.tsx`);
    for (const m of f.matchAll(/<PageTitle/g)) {
      const antes = f.slice(0, m.index);
      const ultimaAba = antes.lastIndexOf("<FavoritosTabs />");
      const ultimoRetorno = Math.max(antes.lastIndexOf("return ("), antes.lastIndexOf("<>"));
      assert.ok(ultimaAba < ultimoRetorno, `${r}: aba antes do título`);
    }
  }
});

test("D7: títulos dos cards de Ferramentas limitados a 2 linhas e com altura uniforme", () => {
  const f = ler("src/app/(dashboard)/dashboard/ferramentas/page.tsx");
  assert.match(f, /<h3 className="[^"]*line-clamp-2[^"]*min-h-\[2\.75rem\][^"]*">\{f\.titulo\}/);
});

test("D8 (revisto no Prompt 48): estado vazio com ícone pequeno, sem ilustração e sempre com um próximo passo", () => {
  const f = ler("src/components/dashboard/primitives.tsx");
  const bloco = f.slice(f.indexOf("export function EmptyState"), f.indexOf("export function FilaVazia"));
  assert.match(bloco, /data-testid="estado-vazio-icone"[\s\S]*h-5 w-5/);
  assert.doesNotMatch(bloco, /illustration|h-20 w-20|rounded-full bg-blue-50/, "sem ilustração nem ícone em círculo grande");
  assert.match(bloco, /action: React\.ReactNode;/, "a ação é obrigatória");
  assert.match(bloco, /data-testid="estado-vazio-acao"/);
});
