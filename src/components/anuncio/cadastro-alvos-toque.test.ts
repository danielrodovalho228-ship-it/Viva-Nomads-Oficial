/*
  Varredura 02/11 (Pista A), cadastro do anúncio a 390 e 768 px (toque): quatro controles abaixo de 44 px.
  1. Regras: os interruptores dos blocos opcionais (silêncio, festas, visitas) — trilho de 28 px.
  2. Detalhes: "−" e "+" dos contadores — 36 px.
  3. Fotos: "Ver fotógrafos na cidade do imóvel" — 20 px.
  4. Preço: "Adicionar faixa de desconto" — 20 px.
  5. Revisão: "Faltam N itens antes de publicar" (abre o que falta) — 20 px.
  Todos ganham alvo de 44 px no toque (.alvo-toque), sem mudar o desenho.
  E1033, passo 3 (família "cadastro", ORDEM-DUET-239): o padrão é 44 × 44 px com QUALQUER apontador. Os 5 usos soltos
  (− e + dos contadores, os 2 links de texto e o motivo da Revisão) trocam .alvo-toque (só tela de toque) por
  .area-de-toque-44 (toque ou rato). O desenho não muda. A trava de tela é a t1700.
  Fatia 2 (ORDEM-DUET-292): os controles do cadastro que nunca tiveram a classe e ficavam abaixo de 44 px. Links
  soltos: a mesma área invisível. Botões de 36 a 42 px e o campo do link do calendário: caixa real de 44 px (min-h-11).
  "Editar" da Revisão: 44 px também de largura. Linhas de abrir e fechar: 44 px de altura sem mexer no que está à volta.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("pergunta do bloco opcional é cartão grande com alvo de 44 px (E193: sem trilho de interruptor)", () => {
  assert.match(ler("src/components/anuncio/bloco-opcional.tsx"), /<CartaoEscolha\s+papel="switch"/);
  assert.match(ler("src/components/anuncio/escolha-assistente.tsx"), /flex min-h-14 w-full items-center gap-3 rounded-xl border-2/);
});

test("contadores: − e + com alvo de 44 px", () => {
  const c = ler("src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx");
  // E1033, passo 3 (asserção alterada): a classe cobrada passa de alvo-toque (só toque) a area-de-toque-44 (toque ou rato).
  assert.equal((c.match(/className="area-de-toque-44 grid h-9 w-9 place-items-center rounded-full/g) ?? []).length, 2);
});

test("links de texto do cadastro com alvo de 44 px", () => {
  // E1033, passo 3 (asserção alterada): area-de-toque-44 no lugar de alvo-toque, nos dois.
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx"), /className="area-de-toque-44 mt-1 inline-block font-medium text-forest underline" data-testid="porta-fotografo-link"/);
  assert.match(ler("src/components/anuncio/blocos-cadastro.tsx"), /className="area-de-toque-44 mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest underline"\n\s*data-testid="adicionar-faixa"/);
});

test("revisão: o motivo de não publicar (abre o que falta) com alvo de 44 px", () => {
  // E1033, passo 3 (asserção alterada): area-de-toque-44 no lugar de alvo-toque.
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"), /onClick=\{onMotivo\} className="area-de-toque-44 block w-full text-balance text-center/);
});

test("contadores: o miolo (o número) é um <label> da altura da pílula — tocar nele foca o campo", () => {
  const c = ler("src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx");
  assert.match(c, /<label className="-my-1 flex w-20 cursor-text items-center justify-center self-stretch" data-testid="contador-miolo">/);
  assert.match(c, /\{sufixo && <span className="shrink-0 text-xs text-muted">\{sufixo\}<\/span>\}\n\s*<\/label>/);
});

test("E1033, passo 3: a família do cadastro já não usa a classe antiga, que só valia em tela de toque", () => {
  for (const arq of [
    "src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx",
    "src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx",
    "src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx",
    "src/components/anuncio/blocos-cadastro.tsx",
  ]) {
    assert.doesNotMatch(ler(arq), /alvo-toque/, arq);
  }
  // A regra nova vale fora de qualquer @media (é o que a faz valer com rato).
  const css = ler("src/app/globals.css");
  assert.match(css, /\n\.area-de-toque-44::after \{[^}]*width: max\(100%, 44px\);[^}]*height: max\(100%, 44px\);/);
});

test("E1033, passo 3, fatia 2: links soltos do cadastro com a área de 44 px", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/travas-de-publicacao.tsx"), /className="area-de-toque-44 ml-1 font-medium text-forest underline underline-offset-4" data-testid=\{`trava-\$\{i\.chave\}-resolver`\}/);
  assert.match(ler("src/components/video-uploader.tsx"), /className="area-de-toque-44 font-medium text-forest underline" data-testid="video-ajuda"/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"), /className="area-de-toque-44 font-medium text-forest underline" data-testid="melhorar-video"/);
});

test("E1033, passo 3, fatia 2: botões de 36 a 42 px e o campo do link passam a 44 px de altura", () => {
  assert.match(ler("src/components/conforto/checklist-conforto.tsx"), /size="sm"\n\s*className="min-h-11"\n\s*disabled=\{desabilitado \|\| faltam === 0\}\n[^\n]*\n\s*data-testid="conforto-marcar-todos"/);
  assert.match(ler("src/components/niveis/camera-prova.tsx"), /size="sm"\n\s*variant="secondary"\n\s*className="min-h-11"/);
  assert.match(ler("src/components/niveis/medir-no-imovel.tsx"), /size="sm"\n\s*variant="secondary"\n\s*className="min-h-11"/);
  assert.match(ler("src/components/property/exportar-calendario.tsx"), /size="sm" className="min-h-11" onClick=\{copiar\} data-testid="exportar-calendario-copiar"/);
  const imp = ler("src/components/property/importar-calendario.tsx");
  assert.match(imp, /className="min-h-11 min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-base"\n\s*data-testid="importacao-link"/);
  assert.match(imp, /size="sm" className="min-h-11" disabled=\{pendente \|\| !link\.trim\(\)\} data-testid="importacao-adicionar"/);
  assert.match(ler("src/components/property/block-calendar.tsx"), /"inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",/);
  // "Adicionar foto" (convite da Revisão e da candidatura): o botão do fluxo único da foto.
  assert.match(ler("src/components/account/foto-perfil.tsx"), /size="sm" onClick=\{escolher\} className=\{cn\("min-h-11", className\)\} data-testid=\{testId\}/);
});

test("E1033, passo 3, fatia 2: os Editar da Revisão têm 44 px também de largura", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"), /className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm font-semibold text-forest underline underline-offset-2"\n\s*aria-label=\{`Editar \$\{i\.rotulo\}`\}/);
});

test("E1033, passo 3, fatia 2: as linhas de abrir e fechar têm 44 px de altura sem empurrar o que está à volta", () => {
  // -my-3 anula o py-3 por fora: a caixa do <summary> cresce para dentro do recuo do <details> (p-3), que fica igual.
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx"), /<details className="mt-3 rounded-xl border border-sage-200 p-3">\n\s*<summary className="-my-3 cursor-pointer py-3 text-sm font-medium text-forest underline">Ver dicas de foto<\/summary>/);
  assert.match(ler("src/components/anuncio/ficha-dentro-campos.tsx"), /<details className="rounded-lg border border-line p-3">\n\s*<summary className="-my-3 cursor-pointer py-3 text-sm font-semibold text-ink">Pratos e talheres \(opcional\)<\/summary>/);
});
