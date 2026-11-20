/**
 * E193 (reprovado em 06/11) + padrão E56 (23/10; decisão do Muse 06/11): o bloco opcional ("Convivência", comodidades extras,
 * detalhes) é um CARTÃO GRANDE tocável como as demais escolhas, COM o interruptor do mockup à direita (role=switch e testid
 * preservados; nasce fechado, abre com dado, confirma ao desligar). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("o bloco opcional do assistente usa o cartão grande, sem trilho de interruptor", () => {
  const src = ler("./bloco-opcional.tsx");
  assert.match(src, /<CartaoEscolha\s+papel="switch"/);
  assert.doesNotMatch(src, /<button[^>]*role="switch"/);
  assert.match(src, /indicador="toggle"/, "o interruptor do mockup (padrão E56) fica à direita do cartão");
  assert.doesNotMatch(src, /translate-x-/, "o trilho mora no CartaoEscolha, não num botão à parte");
  const c = ler("./escolha-assistente.tsx");
  assert.match(c, /indicador === "toggle"/);
  assert.match(c, /h-7 w-12 shrink-0 items-center rounded-full/);
  assert.match(src, /testid=\{`bloco-\$\{id\}-toggle`\}/, "o testid dos specs continua");
});

test("nenhuma tela do assistente desenha interruptor próprio", () => {
  for (const f of ["./regras-casa-campos.tsx", "./detalhes-anuncio-campos.tsx", "./estrutura-acessibilidade.tsx", "../../app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"]) {
    assert.doesNotMatch(ler(f), /role="switch"|<Switch\b/, f);
  }
});
