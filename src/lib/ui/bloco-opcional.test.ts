/*
  C9/E56 — padrão toggle dos blocos opcionais. node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { BLOCOS_TOGGLE_CONTA, aoDesligar, toggleInicial } from "./bloco-opcional.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("nasce fechado sem dados e aberto com dados; desligar com dados pede confirmação", () => {
  assert.equal(toggleInicial(false), false);
  assert.equal(toggleInicial(true), true);
  assert.equal(aoDesligar(false), "fechar");
  assert.equal(aoDesligar(true), "confirmar");
});

test("blocos convertidos na Conta (a lista da rodada) e os textos aprovados", () => {
  assert.deepEqual(BLOCOS_TOGGLE_CONTA.map((b) => b.id), ["pets", "local-trabalho", "redes"]);
  assert.equal(BLOCOS_TOGGLE_CONTA[0].pergunta, "Você tem pet?");
  assert.equal(BLOCOS_TOGGLE_CONTA[0].confirmar, "Remover os pets do seu perfil? Eles saem da sua candidatura.");
});

test("cada bloco convertido usa o BlocoOpcional e o toggle é um switch acessível, sem window.confirm", () => {
  for (const f of ["../../components/account/pets-ficha.tsx", "../../components/account/meu-local-trabalho.tsx", "../../components/account/redes-privadas.tsx"]) {
    const src = ler(f);
    assert.match(src, /<BlocoOpcional/, f);
    assert.match(src, /toggleInicial\(/, f);
  }
  const comp = ler("../../components/ui/bloco-opcional.tsx");
  assert.match(comp, /role="switch"/);
  assert.match(comp, /aria-checked=\{p\.ligado\}/);
  assert.match(comp, /\{p\.ligado && <div/);
  assert.doesNotMatch(comp, /window\.confirm|confirm\(/);
});
