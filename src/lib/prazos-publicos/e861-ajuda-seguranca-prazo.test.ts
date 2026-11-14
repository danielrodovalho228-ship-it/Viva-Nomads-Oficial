import { test } from "node:test";
import assert from "node:assert/strict";
import { FAQ } from "../atendimento/faq.ts";
import { frasePrazo } from "../../config/atendimento.ts";

/* E861: na Ajuda > Segurança, o golpe tinha "prioridade máxima" sem prazo e o chamado comum, prazo nenhum. Cada tipo de
   chamado declara o prazo do canal suporte, pela fonte do atendimento. */
const resposta = (id: string) => FAQ.find((p) => p.id === id)!.resposta;

test("golpe: prioridade máxima COM o prazo do suporte (frase p1 do atendimento)", () => {
  assert.ok(resposta("golpe").includes(frasePrazo("p1")), resposta("golpe"));
});

test("chamado comum (código de acesso): o prazo do suporte (frase do atendimento)", () => {
  assert.ok(resposta("email-confirmacao").includes(frasePrazo("p3")), resposta("email-confirmacao"));
});
