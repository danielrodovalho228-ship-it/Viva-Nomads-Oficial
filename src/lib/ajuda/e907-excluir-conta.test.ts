/*
  E907: a Central de Ajuda não tinha artigo sobre excluir a conta. Entra um artigo curto no tema "Segurança e conta": os dois
  caminhos (na Conta e por /excluir-conta sem entrar), o bloqueio com locação ativa e os prazos — os mesmos fatos da página
  /excluir-conta —, com o link para ela. Roda: node --test src/lib/ajuda/e907-excluir-conta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAQ, buscarFaq, respostaPara } from "../atendimento/faq.ts";
import { perguntasDoTema } from "./temas.ts";

const artigo = FAQ.find((p) => p.id === "excluir-conta");

test("E907: o artigo existe, mora em 'Segurança e conta' e aponta para /excluir-conta", () => {
  assert.ok(artigo, "artigo excluir-conta");
  assert.equal(artigo.pergunta, "Como excluo a minha conta?");
  assert.ok(perguntasDoTema("seguranca").includes("excluir-conta"));
  assert.deepEqual(artigo.links, [{ rotulo: "Excluir a conta", href: "/excluir-conta" }]);
});

test("E907: o texto traz os dois caminhos, o bloqueio com locação ativa e os prazos", () => {
  const r = respostaPara(artigo!, "visitante");
  assert.match(r, /Conta › Privacidade › "Excluir minha conta"/);
  assert.match(r, /sem entrar/i);
  assert.match(r, /link de confirmação/);
  assert.match(r, /locação ou contrato em vigor[^.]*bloqueada até o encerramento/);
  assert.match(r, /na hora da confirmação/);
  assert.match(r, /em até 30 dias/);
  assert.match(r, /prazo exigido por lei/);
});

test("E907: os fatos batem com a página /excluir-conta (mesma regra, sem promessa nova)", () => {
  const pagina = readFileSync(new URL("../../app/(public)/excluir-conta/page.tsx", import.meta.url), "utf8");
  for (const fato of ["bloqueada", "até o encerramento", "em até 30 dias", "prazo exigido por lei", "link de confirmação"]) {
    assert.ok(pagina.includes(fato), `a página diz "${fato}"`);
  }
});

test("E907: a busca da Ajuda acha o artigo", () => {
  for (const q of ["excluir conta", "apagar minha conta", "deletar conta"]) {
    assert.ok(buscarFaq(q).some((p) => p.id === "excluir-conta"), q);
  }
});
