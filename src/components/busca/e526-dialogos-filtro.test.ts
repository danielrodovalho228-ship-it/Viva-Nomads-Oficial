/** E526 (D12, QA de cliques do morador 02/11) — diálogos de filtro da busca sem cobrir o conteúdo — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("o painel das pílulas (Datas, Local, Tipo, Preço, Nível, Ordenar) abre no fluxo da página, não por cima", () => {
  const src = ler("components/busca/barra-pilulas.tsx");
  const painel = src.match(/<div className="([^"]+)" data-testid=\{`painel-pilula-\$\{aberto\}`\}/)?.[1] ?? "";
  assert.ok(painel, "painel encontrado");
  assert.doesNotMatch(painel, /\babsolute\b/, "antes: absolute z-40 por cima do título e dos primeiros cartões");
  assert.doesNotMatch(painel, /\bz-40\b/);
  assert.match(painel, /\bmt-2\b/);
});

test("no painel Datas, o calendário abre em linha (o painel cresce) — antes pintava por cima do próprio painel", () => {
  const src = ler("components/busca/barra-pilulas.tsx");
  assert.match(src, /<CampoData[\s\S]*?calendarioEmLinha[\s\S]*?data-testid="pilula-datas-entrada"/);
  const campo = ler("components/ui/campo-data.tsx");
  assert.match(campo, /calendarioEmLinha/);
  assert.match(campo, /emLinha=\{calendarioEmLinha\}/);
  const cal = ler("components/ui/calendario-br.tsx");
  assert.match(cal, /emLinha \? "relative mt-2 w-full" : "absolute right-0 top-full z-50 mt-2 w-\[19rem\] max-w-\[calc\(100vw-2rem\)\]"/);
});

test("com o calendário em linha, o botão do calendário fica preso ao campo (não desce sobre o calendário)", () => {
  const campo = ler("components/ui/campo-data.tsx");
  // o input e o botão moram numa caixa própria; o calendário vem DEPOIS dela
  assert.match(campo, /<span className="relative block min-w-0">\s*<input[\s\S]*?<\/button>\s*<\/span>\s*\{aberto && \(/);
});

test("os outros campos de data seguem com o calendário flutuante (o padrão não muda)", () => {
  const campo = ler("components/ui/campo-data.tsx");
  assert.match(campo, /calendarioEmLinha = false/);
});
