/**
 * E193 (reprovado em 06/11): o assistente tinha um terceiro estilo de controle — o INTERRUPTOR (trilho) do bloco opcional
 * ("Convivência", comodidades extras, detalhes). A pergunta do bloco é agora o mesmo cartão grande tocável das demais
 * escolhas (role=switch e testid preservados). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("o bloco opcional do assistente usa o cartão grande, sem trilho de interruptor", () => {
  const src = ler("./bloco-opcional.tsx");
  assert.match(src, /<CartaoEscolha\s+papel="switch"/);
  assert.doesNotMatch(src, /<button[^>]*role="switch"/);
  assert.doesNotMatch(src, /translate-x-/, "o trilho (bolinha que desliza) saiu");
  assert.match(src, /testid=\{`bloco-\$\{id\}-toggle`\}/, "o testid dos specs continua");
});

test("nenhuma tela do assistente desenha interruptor próprio", () => {
  for (const f of ["./regras-casa-campos.tsx", "./detalhes-anuncio-campos.tsx", "./estrutura-acessibilidade.tsx", "../../app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"]) {
    assert.doesNotMatch(ler(f), /role="switch"|<Switch\b/, f);
  }
});
