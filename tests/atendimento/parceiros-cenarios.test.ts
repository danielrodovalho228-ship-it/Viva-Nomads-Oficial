/*
  Cenários de teste do atendimento sobre PARCEIROS (ordem 7b7eaca9).
  Separados dos 14 cenários da Viva (o painel do admin mostra "12 de 14"):
  conferem que cada pergunta acha o artigo certo e que o prompt traz os fatos.
  Roda: node --test tests/atendimento/parceiros-cenarios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarFaq, FAQ } from "../../src/lib/atendimento/faq.ts";
import { SYSTEM_VIVA } from "../../src/lib/atendimento/viva-prompt.ts";

const PROIBIDAS = /apartamentos?|comiss[ãa]o|corretagem|intermedia[çc][ãa]o|aluguel|aluguéis/i;

const CASOS: { pergunta: string; artigo: string; resposta: RegExp[] }[] = [
  { pergunta: "Como virar parceiro da Viva?", artigo: "como-virar-parceiro", resposta: [/Fotografia/, /tr[eê]s modos/, /4 passos/, /CNPJ ou MEI/, /\/empresas/, /Plano Gestor/] },
  { pergunta: "Como ativar o modo parceiro na minha conta?", artigo: "como-virar-parceiro", resposta: [/Ativar perfil de parceiro/, /sem novo cadastro/] },
  { pergunta: "Qual é a taxa de parceria?", artigo: "taxa-parceria", resposta: [/10% sobre o valor do serviço/, /todas as categorias/, /90% direto ao parceiro/, /sem mensalidade/i] },
  { pergunta: "A Viva fica com o dinheiro do serviço do fotógrafo?", artigo: "taxa-parceria", resposta: [/não guarda o dinheiro/] },
  { pergunta: "Quando o parceiro vê o contato do proprietário?", artigo: "taxa-parceria", resposta: [/só são liberados/, /aceita o pedido/] },
  { pergunta: "O que acontece se o fotógrafo não entregar? Tem advertência?", artigo: "taxa-parceria", resposta: [/5 dias/, /advert[êe]ncia/, /suspenso/] },
  { pergunta: "Quero contratar um fotógrafo para o meu imóvel", artigo: "contratar-fotografo", resposta: [/Contratar fotógrafo parceiro/, /Uberlândia \(MG\)/, /CEP/] },
];

for (const c of CASOS) {
  test(`parceiros: "${c.pergunta}" acha o artigo ${c.artigo}`, () => {
    const achados = buscarFaq(c.pergunta);
    assert.equal(achados[0]?.id, c.artigo, `primeiro resultado: ${achados[0]?.id}`);
    const texto = achados[0]!.resposta;
    for (const re of c.resposta) assert.match(texto, re);
    assert.doesNotMatch(texto, PROIBIDAS);
  });
}

test("parceiros: o prompt da Viva traz tipos, modos, taxa de serviço de 10%, aceite e começo por Uberlândia", () => {
  for (const re of [/lista de espera por cidade/, /tr[eê]s modos/, /10% sobre o valor do serviço/, /só são liberados/, /Uberlândia \(MG\)/, /Plano Gestor/, /12\/10\/8\/6%/]) {
    assert.match(SYSTEM_VIVA, re);
  }
  assert.doesNotMatch(SYSTEM_VIVA, /até 4%/);
  assert.doesNotMatch(SYSTEM_VIVA, /R\$ ?(40|60|80)(?![\d.,])/, "a taxa fixa dos fotógrafos saiu");
  assert.doesNotMatch(SYSTEM_VIVA, /todo o Brasil/i);
});

test("parceiros: os três artigos novos existem uma vez só e não prometem o que a Viva não faz", () => {
  for (const id of ["como-virar-parceiro", "taxa-parceria", "contratar-fotografo"]) {
    assert.equal(FAQ.filter((f) => f.id === id).length, 1, id);
  }
  const todas = FAQ.filter((f) => ["como-virar-parceiro", "taxa-parceria", "contratar-fotografo"].includes(f.id)).map((f) => f.resposta).join(" ");
  assert.doesNotMatch(todas, /garantimos|garantido|aceito onde o Airbnb/i);
});
