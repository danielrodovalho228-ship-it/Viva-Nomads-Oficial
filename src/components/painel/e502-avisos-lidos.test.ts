import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/*
  E502: no painel do sino, avisos lidos e não lidos pareciam iguais. Causa: o fundo do não lido era `bg-sage-50`, que
  não existe no tema (só sage-100 e sage-200) — não pintava nada; sobrava só o negrito. Agora o não lido tem fundo
  sage-100, barra verde à esquerda, ponto verde e "Não lido" para leitor de tela; o lido fica branco e com o título em
  peso normal. A mesma regra vale no sino e em "Ver todas".
*/
test("E502: o tema não tem sage-50 — o estilo dos avisos usa só cores que existem", () => {
  const css = ler("app/globals.css");
  assert.doesNotMatch(css, /--color-sage-50:/);
  assert.match(css, /--color-sage-100:/);
  for (const f of ["components/painel/sino-avisos.tsx", "components/account/lista-avisos.tsx"]) assert.doesNotMatch(ler(f), /bg-sage-50/, f);
});

test("E502: não lido = fundo sage-100 + barra + ponto + 'Não lido'; lido = branco e título normal", () => {
  const c = ler("components/painel/sino-avisos.tsx");
  assert.match(c, /export function classeDoAviso\(lido: boolean\)/);
  // barra à esquerda por borda (o padrão da casa não aceita sombra solta); no lido, a borda é transparente (sem pulo)
  assert.match(c, /lido \? "border-l-4 border-transparent bg-white" : "border-l-4 border-forest bg-sage-100"/);
  assert.match(c, /export function MarcaLeitura\(\{ lido \}: \{ lido: boolean \}\)/);
  assert.match(c, /data-testid="aviso-ponto-nao-lido"/);
  assert.match(c, /<span className="sr-only">Não lido\. <\/span>/);
});

test("E502: o sino e a lista 'Ver todas' usam a mesma marca", () => {
  for (const f of ["components/painel/sino-avisos.tsx", "components/account/lista-avisos.tsx"]) {
    const c = ler(f);
    assert.match(c, /classeDoAviso\(/, f);
    assert.match(c, /<MarcaLeitura lido=\{/, f);
  }
});
