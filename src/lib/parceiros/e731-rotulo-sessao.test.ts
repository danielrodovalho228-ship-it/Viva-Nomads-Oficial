import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloEnvioParceria, pessoaLogada, ROTULO_CONTINUAR_CONTA, ROTULO_ENVIAR_PARCERIA } from "./sessao-rotulo.ts";

test("E731: o rótulo segue a sessão que a pessoa vê (servidor ou navegador)", () => {
  assert.equal(rotuloEnvioParceria(true, true), ROTULO_ENVIAR_PARCERIA);
  assert.equal(rotuloEnvioParceria(true, false), ROTULO_ENVIAR_PARCERIA);
  assert.equal(rotuloEnvioParceria(false, true), ROTULO_ENVIAR_PARCERIA); // o caso do achado: cabeçalho "Meu painel", rótulo de quem não entrou
  assert.equal(rotuloEnvioParceria(false, false), ROTULO_CONTINUAR_CONTA);
  assert.equal(pessoaLogada(false, false), false);
});

test("E731: o formulário usa o rótulo único e não manda criar conta quem já está logado no navegador", () => {
  const f = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");
  assert.match(f, /rotuloEnvioParceria\(estado\.logado, logadoNoNavegador\)/);
  assert.match(f, /if \(logadoNoNavegador\) return falhar\(ERRO_SESSAO_NAO_CONFIRMADA\)/);
  assert.doesNotMatch(f, /"Continuar: criar conta ou entrar"/);
});
