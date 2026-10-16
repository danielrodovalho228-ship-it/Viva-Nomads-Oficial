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
